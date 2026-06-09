import net from 'node:net'
import tls from 'node:tls'
import crypto from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

export type IPageMailboxConfig = {
  organizationId: string
  mailboxId: string
  mailboxEmail: string
  displayName: string | null
  provider: string
  imapHost: string
  imapPort: number
  imapSecure: boolean
  smtpHost: string
  smtpPort: number
  smtpSecure: boolean
  username: string
  password: string
  lastSyncedAt: string | null
}

export type IPageMailboxSyncResult = {
  syncedMessages: number
  syncedThreads: number
  notes: string
}

export type IPageSendResult = {
  sent: boolean
  notes: string
}

type ImapSearchHit = {
  uid: number
  messageId: string | null
  subject: string | null
  fromAddress: string | null
  toAddresses: string[]
  ccAddresses: string[]
  references: string[]
  inReplyTo: string | null
  body: string
  receivedAt: string | null
}

function trimQuotes(value: string): string {
  return value.trim().replace(/^"|"$/g, '')
}

function normalizeHeaderWhitespace(value: string): string {
  return value.replace(/\r?\n[ \t]+/g, ' ').trim()
}

function extractEmailAddress(value: string | null | undefined): string | null {
  if (!value) return null
  const normalized = value.trim()
  const angled = normalized.match(/<([^>]+)>/)
  if (angled?.[1]) return angled[1].trim()
  const tokens = normalized.split(/\s*,\s*/)
  for (const token of tokens) {
    const emailMatch = token.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
    if (emailMatch?.[0]) return emailMatch[0]
  }
  return normalized || null
}

function extractEmailList(value: string | null | undefined): string[] {
  if (!value) return []
  return value
    .split(',')
    .map((entry) => extractEmailAddress(entry))
    .filter((item): item is string => Boolean(item))
}

function normalizeSubject(subject: string | null): string {
  if (!subject) return 'untitled-thread'
  return subject
    .replace(/^\s*(re|fw|fwd)\s*:\s*/ig, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase() || 'untitled-thread'
}

function safeIsoDate(value: string | null | undefined): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function buildThreadKey(
  mailboxEmail: string,
  messageId: string | null,
  inReplyTo: string | null,
  references: string[],
  subject: string | null,
): string {
  const anchor = (references[0] ?? inReplyTo ?? messageId ?? normalizeSubject(subject) ?? '').trim() || 'no-message-id'
  return `ipage:${mailboxEmail}:${anchor.toLowerCase()}`
}

function parseRfc822(rawMessage: string): ImapSearchHit {
  const [rawHeaderBlock = '', ...bodyParts] = rawMessage.split(/\r?\n\r?\n/)
  const body = bodyParts.join('\n\n').trim()
  const headers: Record<string, string> = {}
  for (const line of rawHeaderBlock.split(/\r?\n/)) {
    if (/^[ \t]/.test(line)) {
      const previous = Object.keys(headers).at(-1)
      if (previous) headers[previous] = `${headers[previous]} ${line.trim()}`
      continue
    }
    const colonIndex = line.indexOf(':')
    if (colonIndex <= 0) continue
    const key = line.slice(0, colonIndex).trim().toLowerCase()
    headers[key] = line.slice(colonIndex + 1).trim()
  }

  const references = (headers.references ?? '')
    .split(/\s+/)
    .map((value) => value.trim())
    .filter(Boolean)

  const receivedAt = safeIsoDate(headers.date)

  return {
    uid: 0,
    messageId: headers['message-id'] ? trimQuotes(headers['message-id']) : null,
    subject: headers.subject ? normalizeHeaderWhitespace(headers.subject) : null,
    fromAddress: extractEmailAddress(headers.from),
    toAddresses: extractEmailList(headers.to),
    ccAddresses: extractEmailList(headers.cc),
    references,
    inReplyTo: headers['in-reply-to'] ? trimQuotes(headers['in-reply-to']) : null,
    body,
    receivedAt,
  }
}

class ImapSession {
  private socket: tls.TLSSocket

  private buffer = Buffer.alloc(0)

  private tagIndex = 0

  private constructor(socket: tls.TLSSocket) {
    this.socket = socket
  }

  static async connect(host: string, port: number): Promise<ImapSession> {
    const socket = tls.connect({
      host,
      port,
      servername: host,
    })

    await new Promise<void>((resolve, reject) => {
      socket.once('secureConnect', () => resolve())
      socket.once('error', reject)
    })

    const session = new ImapSession(socket)
    await session.waitForGreeting()
    return session
  }

  private nextTag(): string {
    this.tagIndex += 1
    return `A${this.tagIndex.toString().padStart(3, '0')}`
  }

  private async readMore(): Promise<void> {
    const chunk = await new Promise<Buffer>((resolve, reject) => {
      const onData = (data: Buffer) => {
        cleanup()
        resolve(Buffer.from(data))
      }
      const onError = (error: Error) => {
        cleanup()
        reject(error)
      }
      const onClose = () => {
        cleanup()
        reject(new Error('IMAP connection closed unexpectedly.'))
      }
      const cleanup = () => {
        this.socket.off('data', onData)
        this.socket.off('error', onError)
        this.socket.off('close', onClose)
      }
      this.socket.once('data', onData)
      this.socket.once('error', onError)
      this.socket.once('close', onClose)
    })
    this.buffer = Buffer.concat([this.buffer, chunk])
  }

  private async waitForGreeting(): Promise<void> {
    await this.readResponseLine()
  }

  private async readResponseLine(): Promise<string> {
    while (true) {
      const lineBreak = this.buffer.indexOf('\r\n')
      if (lineBreak >= 0) {
        const line = this.buffer.slice(0, lineBreak).toString('utf8')
        this.buffer = this.buffer.slice(lineBreak + 2)
        return line
      }
      await this.readMore()
    }
  }

  private async readCommandResult(tag: string): Promise<{ text: string; literal: string | null }> {
    let text = ''
    let literal: string | null = null
    while (true) {
      const line = await this.readResponseLine()
      text = text ? `${text}\n${line}` : line

      const literalMatch = line.match(/\{(\d+)\}$/)
      if (literalMatch) {
        const literalSize = Number(literalMatch[1])
        while (this.buffer.length < literalSize + 2) {
          await this.readMore()
        }
        literal = this.buffer.slice(0, literalSize).toString('utf8')
        this.buffer = this.buffer.slice(literalSize)
        if (this.buffer.slice(0, 2).toString('utf8') === '\r\n') {
          this.buffer = this.buffer.slice(2)
        }
      }

      if (line.startsWith(`${tag} `)) {
        return { text, literal }
      }
    }
  }

  async command(command: string): Promise<string> {
    const tag = this.nextTag()
    this.socket.write(`${tag} ${command}\r\n`)
    const { text } = await this.readCommandResult(tag)
    return text
  }

  async fetchRawMessage(uid: number): Promise<string | null> {
    const tag = this.nextTag()
    this.socket.write(`${tag} UID FETCH ${uid} (UID RFC822)\r\n`)
    const { literal } = await this.readCommandResult(tag)
    return literal
  }

  async search(criteria: string): Promise<number[]> {
    const tag = this.nextTag()
    this.socket.write(`${tag} UID SEARCH ${criteria}\r\n`)
    const { text } = await this.readCommandResult(tag)
    const searchLine = text
      .split('\n')
      .find((line) => line.startsWith('* SEARCH'))
    if (!searchLine) return []
    return searchLine
      .replace('* SEARCH', '')
      .trim()
      .split(/\s+/)
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value > 0)
  }

  async logout(): Promise<void> {
    try {
      const tag = this.nextTag()
      this.socket.write(`${tag} LOGOUT\r\n`)
    } finally {
      this.socket.end()
    }
  }
}

async function connectSmtp(host: string, port: number, secure: boolean): Promise<net.Socket | tls.TLSSocket> {
  if (secure) {
    return await new Promise<tls.TLSSocket>((resolve, reject) => {
      const socket = tls.connect({ host, port, servername: host })
      socket.once('secureConnect', () => resolve(socket))
      socket.once('error', reject)
    })
  }

  return await new Promise<net.Socket>((resolve, reject) => {
    const socket = net.connect({ host, port }, () => resolve(socket))
    socket.once('error', reject)
  })
}

async function upgradeToTls(socket: net.Socket | tls.TLSSocket, host: string): Promise<tls.TLSSocket> {
  if (socket instanceof tls.TLSSocket) return socket
  return await new Promise<tls.TLSSocket>((resolve, reject) => {
    const secureSocket = tls.connect({ socket, servername: host })
    secureSocket.once('secureConnect', () => resolve(secureSocket))
    secureSocket.once('error', reject)
  })
}

type BufferedTransportSocket = (net.Socket | tls.TLSSocket) & { _viloBufferedText?: string }

async function readSmtpLine(socket: net.Socket | tls.TLSSocket): Promise<string> {
  const bufferedSocket = socket as BufferedTransportSocket
  let buffer = bufferedSocket._viloBufferedText ?? ''
  while (true) {
    const newlineIndex = buffer.indexOf('\r\n')
    if (newlineIndex >= 0) {
      const line = buffer.slice(0, newlineIndex)
      const remaining = buffer.slice(newlineIndex + 2)
      bufferedSocket._viloBufferedText = remaining
      return line
    }
    const chunk = await new Promise<string>((resolve, reject) => {
      const onData = (data: Buffer | string) => {
        cleanup()
        resolve(typeof data === 'string' ? data : data.toString('utf8'))
      }
      const onError = (error: Error) => {
        cleanup()
        reject(error)
      }
      const onClose = () => {
        cleanup()
        reject(new Error('SMTP connection closed unexpectedly.'))
      }
      const cleanup = () => {
        socket.off('data', onData)
        socket.off('error', onError)
        socket.off('close', onClose)
      }
      socket.once('data', onData)
      socket.once('error', onError)
      socket.once('close', onClose)
    })
    buffer += chunk
    bufferedSocket._viloBufferedText = buffer
  }
}

async function smtpCommand(socket: net.Socket | tls.TLSSocket, command: string, expectCode: number): Promise<string> {
  socket.write(`${command}\r\n`)
  const lines: string[] = []
  while (true) {
    const line = await readSmtpLine(socket)
    lines.push(line)
    if (!line.startsWith(String(expectCode))) {
      throw new Error(`Unexpected SMTP response for ${command}: ${line}`)
    }
    if (line.length >= 4 && line[3] !== '-') {
      break
    }
  }
  return lines.join('\n')
}

async function authenticateSmtp(socket: net.Socket | tls.TLSSocket, username: string, password: string): Promise<void> {
  const authLine = await smtpCommand(socket, 'AUTH LOGIN', 334)
  if (!authLine.startsWith('334')) {
    throw new Error('SMTP AUTH LOGIN was not accepted.')
  }
  await smtpCommand(socket, Buffer.from(username, 'utf8').toString('base64'), 334)
  await smtpCommand(socket, Buffer.from(password, 'utf8').toString('base64'), 235)
}

function parseLastSyncedDate(lastSyncedAt: string | null): string {
  if (!lastSyncedAt) return '1-Jan-2020'
  const date = new Date(lastSyncedAt)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${String(date.getDate()).padStart(2, '0')}-${months[date.getMonth()]}-${date.getFullYear()}`
}

async function findLinkedContactContext(
  supabase: SupabaseClient,
  organizationId: string,
  message: ImapSearchHit,
): Promise<{
  sensitivity: 'patient' | 'business_development'
  patientLeadId: string | null
  bdCompanyId: string | null
  bdContactId: string | null
  contactPersonId: string | null
  contactOrganizationId: string | null
} | null> {
  const fromEmail = message.fromAddress?.toLowerCase() ?? null
  if (!fromEmail) {
    return null
  }

  const [{ data: patientLead }, { data: bdContact }, { data: contactPerson }, { data: contactOrg }] = await Promise.all([
    supabase
      .from('patient_leads')
      .select('id')
      .eq('organization_id', organizationId)
      .ilike('email', fromEmail)
      .maybeSingle(),
    supabase
      .from('bd_contacts')
      .select('id, company_id')
      .eq('organization_id', organizationId)
      .ilike('email', fromEmail)
      .maybeSingle(),
    supabase
      .from('contact_people')
      .select('id')
      .eq('organization_id', organizationId)
      .ilike('email', fromEmail)
      .maybeSingle(),
    supabase
      .from('contact_organizations')
      .select('id')
      .eq('organization_id', organizationId)
      .ilike('email', fromEmail)
      .maybeSingle(),
  ])

  if (patientLead?.id) {
    return {
      sensitivity: 'patient',
      patientLeadId: String(patientLead.id),
      bdCompanyId: null,
      bdContactId: null,
      contactPersonId: contactPerson?.id ? String(contactPerson.id) : null,
      contactOrganizationId: contactOrg?.id ? String(contactOrg.id) : null,
    }
  }

  if (bdContact?.id || bdContact?.company_id) {
    return {
      sensitivity: 'business_development',
      patientLeadId: null,
      bdCompanyId: bdContact?.company_id ? String(bdContact.company_id) : null,
      bdContactId: bdContact?.id ? String(bdContact.id) : null,
      contactPersonId: contactPerson?.id ? String(contactPerson.id) : null,
      contactOrganizationId: contactOrg?.id ? String(contactOrg.id) : null,
    }
  }

  return {
    sensitivity: 'business_development',
    patientLeadId: null,
    bdCompanyId: null,
    bdContactId: null,
    contactPersonId: contactPerson?.id ? String(contactPerson.id) : null,
    contactOrganizationId: contactOrg?.id ? String(contactOrg.id) : null,
  }
}

export function resolveIPageMailboxConfig(input: {
  organizationId: string
  mailboxId: string
  mailboxEmail: string
  displayName: string | null
  provider: string
  imapHost: string | null
  imapPort: number | null
  imapSecure: boolean | null
  smtpHost: string | null
  smtpPort: number | null
  smtpSecure: boolean | null
  lastSyncedAt: string | null
}): IPageMailboxConfig | null {
  const password = process.env.IPAGE_EMAIL_PASSWORD?.trim()
  if (!password) return null
  const username = process.env.IPAGE_EMAIL_USER?.trim() || input.mailboxEmail
  const imapHost = input.imapHost?.trim() || process.env.IPAGE_IMAP_HOST?.trim() || 'imap.ipage.com'
  const smtpHost = input.smtpHost?.trim() || process.env.IPAGE_SMTP_HOST?.trim() || 'smtp.ipage.com'
  const imapPort = input.imapPort ?? Number(process.env.IPAGE_IMAP_PORT ?? 993)
  const smtpPort = input.smtpPort ?? Number(process.env.IPAGE_SMTP_PORT ?? 465)

  return {
    organizationId: input.organizationId,
    mailboxId: input.mailboxId,
    mailboxEmail: input.mailboxEmail,
    displayName: input.displayName,
    provider: input.provider,
    imapHost,
    imapPort: Number.isFinite(imapPort) ? imapPort : 993,
    imapSecure: input.imapSecure ?? true,
    smtpHost,
    smtpPort: Number.isFinite(smtpPort) ? smtpPort : 465,
    smtpSecure: input.smtpSecure ?? true,
    username,
    password,
    lastSyncedAt: input.lastSyncedAt,
  }
}

export async function syncIPageMailbox(
  supabase: SupabaseClient,
  mailbox: IPageMailboxConfig,
): Promise<IPageMailboxSyncResult> {
  const session = await ImapSession.connect(mailbox.imapHost, mailbox.imapPort)
  const syncedSince = parseLastSyncedDate(mailbox.lastSyncedAt)
  const mailboxLabel = mailbox.mailboxEmail

  try {
    await session.command(`LOGIN "${mailbox.username.replace(/"/g, '\\"')}" "${mailbox.password.replace(/"/g, '\\"')}"`)
    await session.command('SELECT INBOX')
    const uids = await session.search(`SINCE ${syncedSince}`)
    const selectedUids = uids.slice(-25)
    let syncedMessages = 0
    const threadKeys = new Set<string>()

    for (const uid of selectedUids) {
      const rawMessage = await session.fetchRawMessage(uid)
      if (!rawMessage) continue
      const parsed = parseRfc822(rawMessage)
      parsed.uid = uid
      const links = await findLinkedContactContext(supabase, mailbox.organizationId, parsed)
      const threadKey = buildThreadKey(mailboxLabel, parsed.messageId, parsed.inReplyTo, parsed.references, parsed.subject)
      const direction = parsed.fromAddress?.toLowerCase() === mailboxLabel.toLowerCase() ? 'outbound' : 'inbound'
      const subject = parsed.subject ?? '(no subject)'
      const timestamp = parsed.receivedAt ?? new Date().toISOString()
      const context = links ?? {
        sensitivity: 'business_development' as const,
        patientLeadId: null,
        bdCompanyId: null,
        bdContactId: null,
        contactPersonId: null,
        contactOrganizationId: null,
      }

      const { data: threadRow, error: threadError } = await supabase
        .from('communications_threads')
        .upsert(
          {
            organization_id: mailbox.organizationId,
            mailbox_id: mailbox.mailboxId,
            sensitivity: context.sensitivity,
            thread_key: threadKey,
            subject,
            review_status: context.sensitivity === 'patient' ? 'draft' : 'approved',
            patient_lead_id: context.patientLeadId,
            bd_company_id: context.bdCompanyId,
            bd_contact_id: context.bdContactId,
            contact_person_id: context.contactPersonId,
            contact_organization_id: context.contactOrganizationId,
            last_message_at: timestamp,
            last_message_direction: direction,
          },
          { onConflict: 'organization_id,thread_key' },
        )
        .select('id')
        .single()

      if (threadError || !threadRow) {
        throw new Error(threadError?.message ?? 'Unable to upsert communications thread during mailbox sync.')
      }
      threadKeys.add(String(threadRow.id))

      const existingMessage = await supabase
        .from('communications_messages')
        .select('id')
        .eq('organization_id', mailbox.organizationId)
        .eq('thread_id', threadRow.id)
        .eq('provider_message_id', parsed.messageId ?? `uid:${uid}`)
        .maybeSingle()

      const payload = {
        organization_id: mailbox.organizationId,
        mailbox_id: mailbox.mailboxId,
        thread_id: threadRow.id,
        sensitivity: context.sensitivity,
        direction,
        status: direction === 'inbound' ? 'received' : 'sent',
        channel: 'email',
        from_address: parsed.fromAddress,
        to_addresses: parsed.toAddresses,
        cc_addresses: parsed.ccAddresses,
        subject,
        body: parsed.body,
        html_body: null,
        provider_message_id: parsed.messageId ?? `uid:${uid}`,
        provider_thread_id: threadKey,
        patient_lead_id: context.patientLeadId,
        bd_company_id: context.bdCompanyId,
        bd_contact_id: context.bdContactId,
        bd_opportunity_id: null,
        study_id: null,
        study_subject_id: null,
        requires_human_review: direction === 'inbound',
        received_at: direction === 'inbound' ? timestamp : null,
        sent_at: direction === 'outbound' ? timestamp : null,
        error_message: null,
      }

      if (existingMessage.data?.id) {
        const { error: updateError } = await supabase
          .from('communications_messages')
          .update(payload)
          .eq('organization_id', mailbox.organizationId)
          .eq('id', existingMessage.data.id)
        if (updateError) {
          throw new Error(updateError.message)
        }
      } else {
        const { error: insertError } = await supabase.from('communications_messages').insert(payload)
        if (insertError) {
          throw new Error(insertError.message)
        }
        syncedMessages += 1
      }
    }

    return {
      syncedMessages,
      syncedThreads: threadKeys.size,
      notes: syncedMessages > 0
        ? `Synced ${syncedMessages} message${syncedMessages === 1 ? '' : 's'} from ${mailbox.mailboxEmail}.`
        : `No new messages found for ${mailbox.mailboxEmail}.`,
    }
  } finally {
    await session.logout().catch(() => {})
  }
}

export async function testIPageSmtp(mailbox: IPageMailboxConfig): Promise<IPageSendResult> {
  let socket = await connectSmtp(mailbox.smtpHost, mailbox.smtpPort, mailbox.smtpSecure)
  try {
    await readSmtpLine(socket)
    await smtpCommand(socket, 'EHLO vilo-os.local', 250)
    if (!mailbox.smtpSecure) {
      await smtpCommand(socket, 'STARTTLS', 220)
      socket = await upgradeToTls(socket as net.Socket, mailbox.smtpHost)
      await smtpCommand(socket, 'EHLO vilo-os.local', 250)
    }
    await authenticateSmtp(socket, mailbox.username, mailbox.password)
    await smtpCommand(socket, 'QUIT', 221)
    return { sent: false, notes: `SMTP login succeeded for ${mailbox.mailboxEmail}.` }
  } finally {
    socket.end()
  }
}

export async function sendIPageMessage(
  mailbox: IPageMailboxConfig,
  input: {
    fromAddress: string
    toAddresses: string[]
    ccAddresses?: string[]
    subject: string
    body: string
    replyToMessageId?: string | null
  },
): Promise<IPageSendResult> {
  if (!input.toAddresses.length) {
    return { sent: false, notes: 'No recipients were provided for SMTP send.' }
  }

  let socket = await connectSmtp(mailbox.smtpHost, mailbox.smtpPort, mailbox.smtpSecure)
  try {
    await readSmtpLine(socket)
    await smtpCommand(socket, 'EHLO vilo-os.local', 250)
    if (!mailbox.smtpSecure) {
      await smtpCommand(socket, 'STARTTLS', 220)
      socket = await upgradeToTls(socket as net.Socket, mailbox.smtpHost)
      await smtpCommand(socket, 'EHLO vilo-os.local', 250)
    }
    await authenticateSmtp(socket, mailbox.username, mailbox.password)

    const messageId = `<${crypto.randomUUID()}@vilo-os>`
    const headers = [
      `From: ${input.fromAddress}`,
      `To: ${input.toAddresses.join(', ')}`,
      ...(input.ccAddresses?.length ? [`Cc: ${input.ccAddresses.join(', ')}`] : []),
      `Subject: ${input.subject}`,
      `Message-ID: ${messageId}`,
      `Date: ${new Date().toUTCString()}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=utf-8',
      'Content-Transfer-Encoding: 8bit',
      ...(input.replyToMessageId ? [`In-Reply-To: ${input.replyToMessageId}`] : []),
    ]

    await smtpCommand(socket, `MAIL FROM:<${input.fromAddress}>`, 250)
    for (const recipient of input.toAddresses) {
      await smtpCommand(socket, `RCPT TO:<${recipient}>`, 250)
    }
    for (const recipient of input.ccAddresses ?? []) {
      await smtpCommand(socket, `RCPT TO:<${recipient}>`, 250)
    }
    socket.write('DATA\r\n')
    await readSmtpLine(socket)
    socket.write(`${headers.join('\r\n')}\r\n\r\n${input.body}\r\n.\r\n`)
    await readSmtpLine(socket)
    await smtpCommand(socket, 'QUIT', 221)
    return { sent: true, notes: `SMTP send completed for ${input.subject}.` }
  } finally {
    socket.end()
  }
}

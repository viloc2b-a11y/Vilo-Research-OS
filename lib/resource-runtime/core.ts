// TODO: Integrate with real Resource Runtime.
// Currently unimplemented. This acts as a thin explicit adapter interface
// to ensure the operational calendar does not fake runtime ownership.

export async function createResourceBlock(args: unknown): Promise<{ id: string }> {
  throw new Error('NOT_IMPLEMENTED: createResourceBlock is pending actual Resource Runtime integration.')
}

export async function cancelResourceBlock(id: string): Promise<void> {
  throw new Error('NOT_IMPLEMENTED: cancelResourceBlock is pending actual Resource Runtime integration.')
}

export const ResourceCatalogStore = {
  findByCode: async (supabase: unknown, code: string): Promise<{ code: string } | null> => {
    throw new Error('NOT_IMPLEMENTED: ResourceCatalogStore.findByCode is pending actual Resource Runtime integration.')
  }
}


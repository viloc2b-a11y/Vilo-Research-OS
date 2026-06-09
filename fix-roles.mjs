import postgres from 'postgres';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sql = postgres(process.env.DATABASE_URL);

async function fixRoles() {
  try {
    const roles = await sql`
      select distinct role from public.organization_members
      where role not in ('owner', 'admin', 'site_staff', 'research_coordinator', 'pi_sub_i', 'read_only', 'member')
    `;
    console.log('Invalid roles found:', roles);

    if (roles.length > 0) {
      const result = await sql`
        update public.organization_members
        set role = 'member'
        where role not in ('owner', 'admin', 'site_staff', 'research_coordinator', 'pi_sub_i', 'read_only', 'member')
      `;
      console.log(`Updated ${result.count} rows to 'member'`);
    } else {
      console.log('No invalid roles found.');
    }
  } catch (error) {
    console.error('Error fixing roles:', error);
  } finally {
    await sql.end();
  }
}

fixRoles();

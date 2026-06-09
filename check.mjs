import postgres from 'postgres';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sql = postgres(process.env.DATABASE_URL);

async function check() {
  try {
    const res = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'contact_organizations'
      );
    `;
    console.log('Does contact_organizations exist?', res);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sql.end();
  }
}

check();

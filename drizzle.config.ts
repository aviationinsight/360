import 'dotenv/config';
import {defineConfig} from 'drizzle-kit';
export default defineConfig({schema:'./database/schema/index.ts',out:'./database/migrations',dialect:'sqlite',dbCredentials:{url:(process.env.DATABASE_URL||'file:.data/dev.db').replace(/^file:/,'')}});

import 'dotenv/config';
import {defineConfig} from 'drizzle-kit';
export default defineConfig({schema:'./database/schema/index.ts',out:'./database/migrations',dialect:'turso',dbCredentials:{url:process.env.TURSO_DATABASE_URL||'file:.data/dev.db',authToken:process.env.TURSO_AUTH_TOKEN}});

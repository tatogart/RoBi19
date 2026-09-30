// `npm run seed` — wipes ./data and recreates the default world.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Database } from '../db.js';
import { seed } from './seed.js';

const dir = process.env.ROBIS_DATA || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data');
fs.rmSync(dir, { recursive: true, force: true });
seed(new Database(dir));

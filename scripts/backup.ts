import { runBackup } from "../src/lib/backup";
import { pool } from "../src/db";
runBackup("MANUAL_CLI").then((r) => { console.log("Backup written:", r.file, r.size, "bytes"); return pool.end(); }).catch((e) => { console.error(e); process.exit(1); });

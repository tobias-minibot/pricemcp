import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { openDatabase, seed } from '../src/db.js';

const temporaryDirectories:string[]=[];
const temporaryDirectory=()=>{const directory=mkdtempSync(join(tmpdir(),'pricemcp-demo-test-'));temporaryDirectories.push(directory);return directory};
const runSeeder=(databasePath:string)=>spawnSync(process.execPath,['--import','tsx','src/seed-demo.ts'],{
  cwd:process.cwd(),env:{...process.env,PRICEMCP_DB:databasePath},encoding:'utf8'
});

afterEach(()=>{for(const directory of temporaryDirectories.splice(0))rmSync(directory,{recursive:true,force:true})});

describe('demo database reset',()=>{
  it('can rebuild an isolated demo database repeatedly without accumulating records',()=>{
    const databasePath=join(temporaryDirectory(),'pricemcp-demo-test.db');
    const first=runSeeder(databasePath),second=runSeeder(databasePath);
    expect(first.status,first.stderr).toBe(0);
    expect(second.status,second.stderr).toBe(0);
    expect(JSON.parse(second.stdout)).toMatchObject({status:'seeded',synthetic:true,products:31,merchants:6,observations:341,offers:186});
    const db=openDatabase(databasePath);
    expect((db.prepare('PRAGMA foreign_keys').get() as any).foreign_keys).toBe(1);
    db.close();
  });

  it('rejects unsafe filenames and renamed databases containing live products',()=>{
    const directory=temporaryDirectory();
    const unsafePath=join(directory,'pricemcp.db');
    const unsafe=runSeeder(unsafePath);
    expect(unsafe.status).not.toBe(0);
    expect(unsafe.stderr).toContain('Refusing to reset a non-demo database');

    const renamedLivePath=join(directory,'pricemcp-demo-renamed.db');
    const liveDb=openDatabase(renamedLivePath);
    seed(liveDb);
    const liveProductCount=(liveDb.prepare('SELECT count(*) n FROM products').get() as any).n;
    liveDb.close();
    const renamed=runSeeder(renamedLivePath);
    expect(renamed.status).not.toBe(0);
    expect(renamed.stderr).toContain('non-demo products');
    const preserved=openDatabase(renamedLivePath);
    expect((preserved.prepare('SELECT count(*) n FROM products').get() as any).n).toBe(liveProductCount);
    preserved.close();
  });
});

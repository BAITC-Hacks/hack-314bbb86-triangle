export const rows = async (db,sql,...params) => (await db.prepare(sql).bind(...params).all()).results;
export const one = (db,sql,...params) => db.prepare(sql).bind(...params).first();
export const run = (db,sql,...params) => db.prepare(sql).bind(...params).run();
export async function quota(db,key,limit) {
  return Boolean(await db.prepare('INSERT INTO usage (id,count) VALUES (?,1) ON CONFLICT(id) DO UPDATE SET count=count+1 WHERE count < ? RETURNING count').bind(key,limit).first());
}
export async function hash(value) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(x=>x.toString(16).padStart(2,'0')).join('');
}

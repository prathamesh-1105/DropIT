export function formatBytes(bytes: number | bigint): string {
  const numBytes = Number(bytes);
  if (numBytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(numBytes) / Math.log(k));
  return `${parseFloat((numBytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

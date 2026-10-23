function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function formatDateTime24h(input: string) {
  const date = new Date(input);

  if (Number.isNaN(date.getTime())) {
    return input;
  }

  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}
/** 短一點的時間:今天只寫時分,今年寫月日時分,其他年份才寫年 */
export function formatShortDateTime(input: string, now = new Date()) {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return input;
  const full = formatDateTime24h(input);
  if (date.toDateString() === now.toDateString()) return full.slice(11);
  if (date.getFullYear() === now.getFullYear()) return full.slice(5).replace("-", "/");
  return full.slice(0, 10).replaceAll("-", "/");
}

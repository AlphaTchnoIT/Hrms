// Pick only the allowed keys from an object (used to whitelist request bodies)
export function pick(source = {}, keys = []) {
  return keys.reduce((result, key) => {
    if (source[key] !== undefined) result[key] = source[key];
    return result;
  }, {});
}

// Forms send "" for an empty select; convert those to null so ObjectId casting doesn't fail
export function emptyToNull(source = {}, keys = []) {
  const result = { ...source };
  keys.forEach((key) => {
    if (result[key] === '') result[key] = null;
  });
  return result;
}

export function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

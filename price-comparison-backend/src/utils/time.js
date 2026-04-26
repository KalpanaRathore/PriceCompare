function isSameDay(dateA, dateB) {
  const a = new Date(dateA);
  const b = new Date(dateB);

  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

module.exports = {
  isSameDay,
};
export const separateThousands = number => {
  let stringNumber = number + '';
  const rgx = /(\d+)(\d{3})/;
  while (rgx.test(stringNumber)) {
    stringNumber = stringNumber.replace(rgx, '$1' + '.' + '$2');
  }
  return stringNumber;
};

export const getUSDString = (value: any): string => {
  return typeof value === 'number'
    ? value.toLocaleString('USD')
    : String(value);
};

export const cutString = (string, requiredLength): string => {
  return string.length > requiredLength
    ? `${string.slice(0, requiredLength)}...`
    : string;
};

export const separateThousands = (value): string => {
  let stringNumber = value + '';
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

export const cutString = (text: string, requiredLength: number): string => {
  return text.length > requiredLength
    ? `${text.slice(0, requiredLength)}...`
    : text;
};

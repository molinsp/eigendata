const querySelectHeight = 30;
export const querySelectStyles = {
  menuPortal: (base): object => ({ ...base, zIndex: 9999 }),
  control: (base): object => ({
    ...base,
    minHeight: querySelectHeight
  }),
  valueContainer: (base): object => ({
    ...base,
    minHeight: querySelectHeight
  }),
  input: (base): object => ({ ...base, margin: 0 }),
  indicatorsContainer: (base): object => ({
    ...base,
    minHeight: querySelectHeight
  })
};

export const formulabarMainSelect = {
  // The main container of Select
  control: (base, { isFocused }): object => ({
    ...base,
    borderColor: isFocused ? '#252FFF' : '#666DFF',
    borderWidth: 2,
    borderRadius: 10,

    ':hover': {
      borderColor: isFocused ? '#252FFF' : '#5d64d0'
    }
  }),
  //Indicator container
  indicatorsContainer: (base): object => ({
    ...base,
    width: 40,
    paddingRight: 10,
    paddingLeft: 10
  })
};

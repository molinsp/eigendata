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
    borderColor: isFocused ? '#2684FF' : '#A6A6A6',
    borderWidth: 2,
    borderRadius: 10,

    ':hover': {
      borderColor: isFocused ? '#2684FF' : '#777777'
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

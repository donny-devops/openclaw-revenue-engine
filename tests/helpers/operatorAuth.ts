export const operatorAuthHeaders = (): Record<string, string> => {
  const token = process.env.OPERATOR_API_KEY;
  if (!token) {
    throw new Error('operatorAuthHeaders requires OPERATOR_API_KEY');
  }
  return { authorization: ['Bearer', token].join(' ') };
};

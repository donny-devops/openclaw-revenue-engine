import jwt from 'jsonwebtoken';

export const operatorAuthHeaders = (): Record<string, string> => {
  const token =
    process.env.OPERATOR_API_KEY ??
    (process.env.JWT_SECRET ? jwt.sign({ sub: 'operator' }, process.env.JWT_SECRET) : undefined);
  if (!token) {
    throw new Error('operatorAuthHeaders requires OPERATOR_API_KEY or JWT_SECRET');
  }
  return { authorization: ['Bearer', token].join(' ') };
};

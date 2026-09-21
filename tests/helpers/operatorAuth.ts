import jwt from 'jsonwebtoken';

export const operatorAuthHeaders = (): Record<string, string> => {
  const token =
    process.env.OPERATOR_API_KEY ??
    (process.env.JWT_SECRET ? jwt.sign({ sub: 'operator' }, process.env.JWT_SECRET) : undefined);
  return token ? { authorization: ['Bearer', token].join(' ') } : {};
};

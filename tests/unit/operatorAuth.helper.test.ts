import { operatorAuthHeaders } from '../helpers/operatorAuth';

describe('operatorAuthHeaders', () => {
  const originalApiKey = process.env.OPERATOR_API_KEY;

  afterEach(() => {
    if (originalApiKey === undefined) {
      delete process.env.OPERATOR_API_KEY;
      return;
    }
    process.env.OPERATOR_API_KEY = originalApiKey;
  });

  it('builds a bearer authorization header from OPERATOR_API_KEY', () => {
    process.env.OPERATOR_API_KEY = 'test_operator_api_key';
    const headers = operatorAuthHeaders();
    expect(headers.authorization.split(' ')).toEqual(['Bearer', 'test_operator_api_key']);
  });

  it('fails fast when OPERATOR_API_KEY is missing', () => {
    delete process.env.OPERATOR_API_KEY;
    expect(() => operatorAuthHeaders()).toThrow('operatorAuthHeaders requires OPERATOR_API_KEY');
  });
});

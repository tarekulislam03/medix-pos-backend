import { jest } from '@jest/globals';

jest.unstable_mockModule('axios', () => ({
  default: {
    post: jest.fn().mockResolvedValue({ data: { secure_url: "mock_url", public_id: "mock_id" } })
  }
}));

const { default: axios } = await import('axios');
const res = await axios.post('url');
console.log("MOCKED RESPONSE:", res);

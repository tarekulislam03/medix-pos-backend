import { rateLimit } from 'express-rate-limit';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  keyGenerator: (req, res) => {
    return req.body.phone || req.socket.remoteAddress;
  },
  
  message: { error: 'Account temporarily locked. Try again in 15 minutes.' },
});

export { loginLimiter };
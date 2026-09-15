import { randomBytes, createHash } from 'node:crypto';
export const tokenHash = token => createHash('sha256').update(token).digest('hex');
export const newToken = () => randomBytes(32).toString('hex');
export function authenticate(User) {
  return async (req,res,next) => {
    const token = req.headers.authorization?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
    if (!token) return res.status(401).json({error:'Please create a traveler session first.'});
    try {
      req.user = await User.findOne({tokenHash:tokenHash(token)});
      if (!req.user) return res.status(401).json({error:'Session expired. Please sign in again.'});
      next();
    } catch(error) { next(error); }
  };
}

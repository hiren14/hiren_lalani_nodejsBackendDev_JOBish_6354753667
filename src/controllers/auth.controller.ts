import type { Request, Response } from 'express';
import { authService } from '../services/auth.service';

export const authController = {
  async register(req: Request, res: Response) {
    const user = await authService.register(req.body);
    res.status(201).json({ success: true, data: user });
  },
  async login(req: Request, res: Response) {
    const token = await authService.login(req.body);
    res.status(200).json({ success: true, data: token });
  },
  providerToken(req: Request, res: Response) {
    const token = authService.providerToken(req.body.apiKey);
    res.status(200).json({ success: true, data: token });
  },
};

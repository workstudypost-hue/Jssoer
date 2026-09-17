import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface JwtPayload {
  sub: string; // userId
  roles: string[];
  isStaff?: boolean;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_ACCESS_SECRET,
    });
  }

  // القيمة المُرجَعة هنا تُحقن تلقائيًا في request.user. نُضيف userId كمرادف
  // صريح لـ sub (بدل استخدام sub وحده) لأن بعض الخدمات (custom-requests
  // تحديدًا) تتوقع actor.userId بشكل صريح - الإبقاء على sub أيضًا يحافظ على
  // التوافق مع بقية الكود الذي يقرأ req.user.sub مباشرة فلا داعي لتعديله.
  async validate(payload: JwtPayload) {
    return { ...payload, userId: payload.sub };
  }
}

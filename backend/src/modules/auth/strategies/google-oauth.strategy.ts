import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';

export interface OAuthProfile {
  provider: 'google' | 'microsoft';
  providerUserId: string;
  email?: string;
  emailVerified: boolean;
  fullName?: string;
}

@Injectable()
export class GoogleOAuthStrategy extends PassportStrategy(Strategy, 'google') {
  constructor() {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID ?? 'not-configured',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? 'not-configured',
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
      scope: ['email', 'profile'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<void> {
    const email = profile.emails?.[0]?.value;
    const oauthProfile: OAuthProfile = {
      provider: 'google',
      providerUserId: profile.id,
      email,
      // Google لا يُرجع حسابًا إلا وبريده مُتحقَّق منه فعليًا من طرفه
      emailVerified: profile.emails?.[0]?.verified ?? true,
      fullName: profile.displayName,
    };
    done(null, oauthProfile);
  }
}

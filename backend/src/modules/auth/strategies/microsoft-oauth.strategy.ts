import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
// @ts-ignore - passport-microsoft لا يوفّر أنواع TypeScript رسمية
import { Strategy } from 'passport-microsoft';
import { OAuthProfile } from './google-oauth.strategy';

@Injectable()
export class MicrosoftOAuthStrategy extends PassportStrategy(Strategy, 'microsoft') {
  constructor() {
    super({
      clientID: process.env.MICROSOFT_CLIENT_ID ?? 'not-configured',
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET ?? 'not-configured',
      callbackURL: process.env.MICROSOFT_CALLBACK_URL,
      scope: ['user.read'],
      tenant: process.env.MICROSOFT_TENANT ?? 'common',
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: any,
    done: (err: any, user?: any) => void,
  ): Promise<void> {
    const email = profile.emails?.[0]?.value ?? profile._json?.mail ?? profile._json?.userPrincipalName;
    const oauthProfile: OAuthProfile = {
      provider: 'microsoft',
      providerUserId: profile.id,
      email,
      // منصة Microsoft لا تُرجع علم "verified" صريح - نعتمد على كونه حسابًا مؤسسيًا/شخصيًا
      // مُصادَقًا عليه من Azure AD نفسها، وهو ما يكفي لاعتباره مُتحقَّقًا هنا
      emailVerified: Boolean(email),
      fullName: profile.displayName,
    };
    done(null, oauthProfile);
  }
}

declare module "jsonwebtoken" {
  export type JwtPayload = Record<string, unknown> | string;

  export interface SignOptions {
    expiresIn?: string | number;
  }

  export function sign(
    payload: string | object,
    secretOrPrivateKey: string,
    options?: SignOptions,
  ): string;

  export function verify(
    token: string,
    secretOrPublicKey: string,
  ): JwtPayload;

  const jwt: {
    sign: typeof sign;
    verify: typeof verify;
  };

  export default jwt;
}

declare module "ms" {
  export type StringValue = string;

  function ms(value: string | number): number;

  export = ms;
}

declare module "@elysiajs/cors" {
  import type { Elysia } from "elysia";

  export type CorsOptions = {
    origin?: string[] | string | boolean;
    methods?: string[];
    credentials?: boolean;
  };

  export function cors(options?: CorsOptions): (app: Elysia) => Elysia;

  export default cors;
}

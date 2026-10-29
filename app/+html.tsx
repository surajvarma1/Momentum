import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

/**
 * Root HTML configuration for Momentum web.
 * Sets the default HTML background to dark (#0A0A0C) to eliminate blank white flashes.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <title>Momentum</title>
        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              html, body, #root {
                height: 100%;
                background-color: #0A0A0C;
                color: #FFFFFF;
                margin: 0;
                padding: 0;
              }
            `,
          }}
        />
      </head>
      <body style={{ backgroundColor: '#0A0A0C', margin: 0, padding: 0 }}>{children}</body>
    </html>
  );
}

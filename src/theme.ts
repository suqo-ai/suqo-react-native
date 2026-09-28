/**
 * Every colour, radius and spacing value the sheet chrome uses.
 *
 * The only module in this package that holds a hex. The chrome deliberately stays small and
 * neutral: the payment block itself is rendered by the SUQO checkout page inside the
 * WebView, which brings its own styling, and a second visual language wrapped around it
 * would read as two products stacked.
 *
 * @packageDocumentation
 */

export const theme = {
  color: {
    /** SUQO primary. Spinner and the retry action. */
    primary: '#635BFF',
    /** Sheet ground. */
    surface: '#FFFFFF',
    /** Headings and the seller's name. */
    text: '#0D062D',
    /** Secondary copy. */
    muted: '#667080',
    /** Hairline under the header. */
    border: '#EAEAEA',
  },
  radius: {
    button: 10,
  },
  space: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
  },
} as const

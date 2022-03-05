# Solar Core - Utilities

<p align="center">
    <img src="../../banner.png" />
</p>

## Caveats

- The native `map`, `filter`, `reduce` and `forEach` will generally be faster when used on arrays that contain nothing but numerical values.
- If you plan to use `formatCurrency` method with node.js for anything else then the `en-US` locale you'll have to make sure to properly setup https://github.com/unicode-org/full-icu-npm as node.js itself only ships with the `en-US` locale by default unless specifically build with more locales.
- Do not use the `is*` methods of this package inside the [Node.js VM](https://nodejs.org/api/vm.html) as the results could be misleading.
- The `pluralize` method does not support irregular plurals. Check [blakeembrey/pluralize](https://github.com/blakeembrey/pluralize) if you need support for those.

## Security

If you discover a security vulnerability within this package, please send an e-mail to security@solar.org. All security vulnerabilities will be promptly addressed.

## Credits

This project exists thanks to all the people who [contribute](../../../../contributors).

## License

Please read the separate [LICENSE](../../LICENSE) file for details.

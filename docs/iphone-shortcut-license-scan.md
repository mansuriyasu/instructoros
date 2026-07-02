# iPhone Shortcut: Add SparkOn Student From Licence

Create a Shortcut named `Add SparkOn Student`.

Shortcut settings:
- Turn on `Show in Share Sheet`
- Accepted input: `Images` and `PDFs`

Shortcut actions:
1. `Get File from Shortcut Input`
2. If sharing a photo, use `Convert Image` to `JPEG`
3. `Get Contents of URL`
   - URL: `https://instructoros.ca/api/shortcuts/license-scan`
   - Method: `POST`
   - Headers:
     - `x-sparkon-shortcut-secret`: your private shortcut secret
   - Request Body: `Form`
   - Form field:
     - Key: `license`
     - Type: `File`
     - Value: the shared file or converted JPEG
4. `Get Dictionary from Input`
5. Show `message` from the response.

If the response says the shortcut is not authorized, the secret in the shortcut does not match the `SHORTCUT_SECRET` environment variable on Hostinger.

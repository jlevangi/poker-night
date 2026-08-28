# Container releases

Gamble King images are published to `ghcr.io/jlevangi/poker-night` from immutable semantic-version tags.

## Publish

1. Confirm `main` is clean and CI is passing.
2. Update `version.txt` to the release version.
3. Commit and push the version change.
4. Create and push the matching tag:

   ```bash
   git tag -a v2.5.4 -m "Gamble King v2.5.4"
   git push origin v2.5.4
   ```

The tag must match `vMAJOR.MINOR.PATCH`. The workflow publishes only the exact version tag, such as `ghcr.io/jlevangi/poker-night:2.5.4`; it does not publish mutable `latest`, major, or minor tags.

## Verify

Check the GitHub Actions run, then pull without registry credentials:

```bash
docker logout ghcr.io || true
docker pull ghcr.io/jlevangi/poker-night:2.5.4
```

If anonymous pull fails, change the package visibility to public under the repository package settings before using it from K3s without an `imagePullSecret`.

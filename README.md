# Sample AEM project template

This is a project template for AEM-based applications. It is intended as a best-practice set of examples as well as a potential starting point to develop your own functionality.

## Modules

The main parts of the template are:

* [core:](core/README.md) Java bundle containing all core functionality like OSGi services, listeners or schedulers, as well as component-related Java code such as servlets or request filters.
* [it.tests:](it.tests/README.md) Java based integration tests
* [ui.apps:](ui.apps/README.md) contains the /apps (and /etc) parts of the project, ie JS&CSS clientlibs, components, and templates
* [ui.content:](ui.content/README.md) contains sample content using the components from the ui.apps
* ui.config: contains runmode specific OSGi configs for the project
* [ui.frontend:](ui.frontend.general/README.md) an optional dedicated front-end build mechanism (general Webpack project)
* [ui.tests:](ui.tests/README.md) Cypress based UI tests (for other frameworks check [aem-test-samples](https://github.com/adobe/aem-test-samples) repository
* all: a single content package that embeds all of the compiled modules (bundles and content packages) including any vendor dependencies
* analyse: this module runs analysis on the project which provides additional validation for deploying into AEMaaCS

## How to build

To build all the modules run in the project root directory the following command with Maven 3:

    mvn clean install

To build all the modules and deploy the `all` package to a local instance of AEM, run in the project root directory the following command:

    mvn clean install -PautoInstallSinglePackage

Or to deploy it to a publish instance, run

    mvn clean install -PautoInstallSinglePackagePublish

Or alternatively

    mvn clean install -PautoInstallSinglePackage -Daem.port=4503

Or to deploy only the bundle to the author, run

    mvn clean install -PautoInstallBundle

Or to deploy only a single content package, run in the sub-module directory (i.e `ui.apps`)

    mvn clean install -PautoInstallPackage

## Documentation

### Deploy to an RDE using Python REST calls

`scripts/rde_install.py` installs an already-built local artifact without using
the AIO CLI for deployment. It requires Python 3.9+ and only the standard library.
It creates an RDE update, uploads through signed Azure File Storage, applies the
update, waits for completion, and retrieves logs.

```bash
python3 scripts/rde_install.py --help
export TOKEN="$(aio auth:login --bare --no-open --ctx cli)"
python3 scripts/rde_install.py all/target/rdepoc.all-1.0.0-SNAPSHOT.zip \
  --program-id YOUR_PROGRAM_ID --environment-id YOUR_RDE_ID --target both
unset TOKEN
```

Choose the IMS context matching your RDE login instead of `cli` if necessary.
AIO is only needed in this example to obtain an IMS token; alternatively supply
your raw IMS token exclusively via the `TOKEN` environment variable, without a
`Bearer` prefix. Cloud Manager discovery and RDE API calls send
`Authorization: Bearer <TOKEN>`. Azure uploads use their signed URL instead and
never receive the IMS token. Token-file and token command-line arguments are
not supported.
`TOKEN` is the only credential input. Before making network calls, the script
decodes its JWT payload and requires a valid `client_id` and supported IMS `as`
claim. It queries IMS `/ims/organizations/v6` and builds organization IDs from
`orgRef.ident + '@' + orgRef.authSrc`. If there are multiple organizations, it
checks which can access the requested Cloud Manager program/environment; no
match or multiple matches stop deployment rather than picking arbitrarily.
Expected HTTP 403/404 responses during multi-org selection are reported;
authentication errors and unexpected failures stop the operation.

`main()` explicitly orchestrates these phases:
`validate_token()` -> `configure_api_context()` -> `discover_environment()` ->
`validate_environment()` -> `install()`. Token validation checks the credential
and its required claims without network calls. Configuration prepares hosts and
headers. Discovery queries IMS and Cloud Manager. Environment validation checks
the org ID, unique match, RDE type, and safe endpoint without network calls.
The selected environment and resolved endpoint are reused during deployment.
`install()` rejects an installer that has not passed environment validation.
JWT segment checks happen in `validate_token()` before it calls `get_client_id(token)`.
That helper delegates decoding to `decode_ims_token()` and also captures the
auth-server claim, so the payload is decoded only once. API host/header setup
is handled by `configure_api_context()` after the claims have been validated.

The client ID and selected org ID are stored in memory only. Authenticated Adobe
calls use default `Authorization`, `x-api-key`, and, once selected,
`x-gw-ims-org-id` headers; signed Azure uploads receive none of these.
JWT decoding is not signature validation: Adobe validates the token through its
APIs. The JWT `as` claim selects the supported production or staging IMS and
Cloud Manager hosts; it cannot select an arbitrary URL. Separate client ID/org
ID arguments and environment variables are no longer used.

The script discovers the RDE API base by reading
`GET https://cloudmanager.adobe.io/api/program/{programId}/environment/{environmentId}`.
It verifies the returned IDs and `type=rde`, then uses the Developer Console
link's origin plus `/api/rde`. Both IDs are required because a program can have
multiple environments. The IMS token must be allowed to read that Cloud Manager
environment.

Discovery is mandatory; there is no manual base URL override.
Discovery failures stop deployment rather than guessing or using a cached URL.
The RDE API base is not the author/publish host or Cloud Manager pipeline
endpoint. The token must remain valid for the deployment. Use `--ca-bundle` if
corporate TLS requires a custom PEM trust bundle; certificate verification is
never disabled.

This implements the underlying Adobe RDE CLI protocol, not a separately
guaranteed public API. It does not build artifacts or promote them to other
environments. Failed, staged, unknown, and timed-out updates exit nonzero.
Retries are bounded and apply only to reads and idempotent Azure uploads, not
RDE update creation/application. If interrupted or timed out, check the printed
update ID before reinstalling. A logs endpoint that remains HTTP 404 produces
an explicit warning rather than changing a completed deployment to failure.
Signed upload URLs and the supplied token are redacted from output.

Run the script's isolated tests with:

```bash
python3 -m unittest discover -s scripts -p 'test_rde_install.py'
```

The build process also generates documentation in the form of README.md files in each module directory for easy reference. Depending on the options you select at build time, the content may be customized to your project.

## Testing

### Adaptive Form Star Rating

`rdepoc/components/adaptiveForm/starrating` is available in the **rdepoc - Adaptive
Form** component group. It extends the public Forms Core Components
`AbstractFieldImpl` API, compiled against Cloud GA **3.0.172**; the Forms runtime
is supplied by AEM Cloud Service, not embedded in this application.

The `com.rdepoc.core.models.forms` package is versioned in `package-info.java`
so the project's bnd configuration exports it. Sling Model registration alone
does not expose the `StarRating` interface to AEM's HTL Java compiler. If rendering
fails with `StarRating cannot be resolved to a type`, ensure the deployed
`rdepoc.core` bundle is active and its `Export-Package` header contains
`com.rdepoc.core.models.forms`. Rebuild and deploy the updated core bundle, not
just `ui.apps`; an existing `all/target` archive must also be rebuilt before use.
The model test suite checks the generated bundle manifest as well as adaptation.

The author dialog inherits the standard name, title, binding, validation, help,
accessibility, and visibility settings. **Number of stars** (`maximum`) defaults
to five and must be a positive whole number. **Default rating** is optional and
must be a whole number from one to that maximum. The exported field is
`fieldType: "number-input"` with `type: "integer"`, `step: 1`, `minimum: 1`, and the configured
`maximum`; submissions contain one numeric value, not an array or star label.
Rules, prefill, reset, and validation use the standard Forms model. Invalid
authored maxima/defaults fail model creation with a logged configuration error.
The step constraint rejects fractional values supplied through prefill or rules;
the widget itself only selects whole-star values.

HTL uses the numeric `selectedRating` rendering helper for star comparisons.
It returns zero when no default is set, leaving all stars unselected without
comparing null to a number. This helper is excluded from JSON; the form's unset
default remains null.

The Star Rating runtime client library depends on
`core.forms.components.runtime.all`, so the complete Forms runtime loads before
the custom field registers. Depending only on `runtime.base` allows a later
`runtime.all` load to replace the field registry, leaving stars visible but
unbound to the form model.

Tab enters the native radio group; arrow keys move/select a star, and Space
selects the focused star. **Clear rating** clears an optional field. Required
fields cannot be cleared through that button. Read-only ratings remain
focusable but reject selection; disabled ratings cannot receive focus. Labels,
help text, validation announcements, and visible focus indicators use the shared
Forms templates and the component clientlib, which the HTL includes itself.

After installing the application packages, open
`/content/rdepoc/us/en/star-rating-example.html` to see optional, required,
read-only, and disabled examples. Existing form-container policies already allow
the component group; other templates must allow it in their container policy.
This sample is not a published Adaptive Form asset in Forms & Documents.

Run the model tests using Java 11 or newer:

```bash
mvn -pl core -am test -Dtest=StarRatingImplTest -Dsurefire.failIfNoSpecifiedTests=false
```

The isolated Cypress suite uses the real published Forms runtime and model
engine with a local DOM fixture; it does not need an AEM server. Extract
`core-forms-components-af-apps-3.0.172.zip` from Maven Central and set
`FORMS_RUNTIME_JS` to its
`jcr_root/apps/core/fd/af-clientlibs/core-forms-components-runtime-base/js/main.js`.
From `ui.tests/test-module`, run:

```bash
npx cypress run --browser electron \
  --config '{"baseUrl":null,"specPattern":"cypress/component/starrating.cy.js","video":false}' \
  --env FORMS_RUNTIME_JS=/absolute/path/to/extracted/main.js
```

The suite covers numeric updates, clear/reset, keyboard selection, focus,
read-only/disabled/required states, validation announcements, and repeat-instance
radio names. A deployed AEM smoke check and assistive-technology review remain
necessary before release.

There are three levels of testing contained in the project:

### Unit tests

This show-cases classic unit testing of the code contained in the bundle. To
test, execute:

    mvn clean test

### Integration tests

This allows running integration tests that exercise the capabilities of AEM via
HTTP calls to its API. To run the integration tests, run:

    mvn clean verify -Plocal

Test classes must be saved in the `src/main/java` directory (or any of its
subdirectories), and must be contained in files matching the pattern `*IT.java`.

The configuration provides sensible defaults for a typical local installation of
AEM. If you want to point the integration tests to different AEM author and
publish instances, you can use the following system properties via Maven's `-D`
flag.

| Property              | Description                                         | Default value           |
|-----------------------|-----------------------------------------------------|-------------------------|
| `it.author.url`       | URL of the author instance                          | `http://localhost:4502` |
| `it.author.user`      | Admin user for the author instance                  | `admin`                 |
| `it.author.password`  | Password of the admin user for the author instance  | `admin`                 |
| `it.publish.url`      | URL of the publish instance                         | `http://localhost:4503` |
| `it.publish.user`     | Admin user for the publish instance                 | `admin`                 |
| `it.publish.password` | Password of the admin user for the publish instance | `admin`                 |

The integration tests in this archetype use the [AEM Testing
Clients](https://github.com/adobe/aem-testing-clients) and showcase some
recommended [best
practices](https://github.com/adobe/aem-testing-clients/wiki/Best-practices) to
be put in use when writing integration tests for AEM.

## Static Analysis

The `analyse` module performs static analysis on the project for deploying into AEMaaCS. It is automatically
run when executing

    mvn clean install

from the project root directory. Additional information about this analysis and how to further configure it
can be found here https://github.com/adobe/aemanalyser-maven-plugin

### UI tests

They will test the UI layer of your AEM application using Cypress framework.

Check README file in `ui.tests` module for more details.

Examples of UI tests in different frameworks can be found here: https://github.com/adobe/aem-test-samples

## ClientLibs

The frontend module is made available using an [AEM ClientLib](https://helpx.adobe.com/experience-manager/6-5/sites/developing/using/clientlibs.html). When executing the NPM build script, the app is built and the [`aem-clientlib-generator`](https://github.com/wcm-io-frontend/aem-clientlib-generator) package takes the resulting build output and transforms it into such a ClientLib.

A ClientLib will consist of the following files and directories:

- `css/`: CSS files which can be requested in the HTML
- `css.txt` (tells AEM the order and names of files in `css/` so they can be merged)
- `js/`: JavaScript files which can be requested in the HTML
- `js.txt` (tells AEM the order and names of files in `js/` so they can be merged
- `resources/`: Source maps, non-entrypoint code chunks (resulting from code splitting), static assets (e.g. icons), etc.

## Simplified Index Management

If you're building for AEM as a Cloud Service, this project includes a `diff.index` under
`ui.apps/src/main/content/jcr_root/_oak_index` ([documentation](https://oak-indexing.github.io/oakTools/simplified.html)).
Packaging it triggers a benign Maven build warning from the `jackrabbit-nodetypes` validator
(`... is not allowed as child of node with potential default types [nt:folder] ... /oak:index/diff.index`),
because `/oak:index`'s real node type isn't declared in any content package. It's a known false
positive and safe to ignore.

## Maven settings

The project comes with the auto-public repository configured. To setup the repository in your Maven settings, refer to:

    http://helpx.adobe.com/experience-manager/kb/SetUpTheAdobeMavenRepository.html

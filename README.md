'write in terminal:

pushd \\grafana\Rizone\Projects\meeting

set PLAYWRIGHT_BROWSERS_PATH=0



to run the script:

test env:
npm run test:dev

prod env:
npm run test:prod

both:
npm run test:all
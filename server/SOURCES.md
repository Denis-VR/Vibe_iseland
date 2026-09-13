# Geography and weather

`cities.json`: reduced GeoNames cities15000 dataset; `regions.json`: GeoNames admin1CodesASCII. Downloaded 2026-09-13.
- https://download.geonames.org/export/dump/cities15000.zip
- https://download.geonames.org/export/dump/admin1CodesASCII.txt
- Attribution: GeoNames, https://www.geonames.org/ — CC BY 4.0, https://creativecommons.org/licenses/by/4.0/
- Fields kept for local search and nearest-city resolution. Nearest city is approximate, not an administrative boundary lookup; some small settlements are absent. The city centre is used for weather.

Weather: Open-Meteo, https://open-meteo.com/en/docs — API data attribution CC BY 4.0. Current weather and sunrise/sunset, cached 15 minutes. Public API is for non-commercial use; see https://open-meteo.com/en/terms for service limits before commercial hosting.

IP geography: geoip-lite bundled GeoLite data, https://github.com/geoip-lite/node-geoip. Database attribution: MaxMind, https://www.maxmind.com/. IP geolocation is approximate and can identify a VPN/provider location rather than a visitor. Refresh the database per package documentation when maintaining the server.

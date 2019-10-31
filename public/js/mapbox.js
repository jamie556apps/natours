/* eslint-disable */

export const displayMap = locations => {
  mapboxgl.accessToken =
    'pk.eyJ1IjoiamFtaWU1NTYiLCJhIjoiY2syNjdhdTB3MXJlMDNnbnl5dW83c2ZpZiJ9.sgSIxXAHL4rr6Z_tPsS7rA';

  var map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/jamie556/ck267e1yb08bn1cpcq3aqk9rk',
    scrollZoom: false
  });

  const bounds = new mapboxgl.LngLatBounds();

  locations.forEach(loc => {
    // Create market
    const el = document.createElement('div');

    el.className = 'marker';

    // Add marker
    new mapboxgl.Marker({
      element: el,
      anchor: 'bottom'
    })
      .setLngLat(loc.coordinates)
      .addTo(map);

    // Add popup
    new mapboxgl.Popup({
      offset: 30
    })
      .setLngLat(loc.coordinates)
      .setHTML(`<p>Day ${loc.day}: ${loc.description}</p>`)
      .addTo(map);

    // Extent map bounds to include current location
    bounds.extend(loc.coordinates);
  });

  map.fitBounds(bounds, {
    padding: {
      top: 200,
      bottom: 200,
      left: 200,
      right: 200
    }
  });
};

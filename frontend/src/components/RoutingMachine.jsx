import { useEffect, useRef } from "react";
import L from "leaflet";
import { useMap } from "react-leaflet";
import "leaflet-routing-machine";
import "leaflet-routing-machine/dist/leaflet-routing-machine.css";

const RoutingMachine = ({ start, end, color, onInstructionsFound }) => {
  const map = useMap();
  const routingControlRef = useRef(null);

  useEffect(() => {
    if (!map || !start || !end) return;

    // Create the control ONLY if it doesn't exist
    if (!routingControlRef.current) {
      routingControlRef.current = L.Routing.control({
        waypoints: [
          L.latLng(start[0], start[1]),
          L.latLng(end[0], end[1])
        ],
        lineOptions: {
          styles: [{ color: color || "#1a73e8", weight: 6, opacity: 0.8 }]
        },
        show: false,
        addWaypoints: false,
        routeWhileDragging: false,
        draggableWaypoints: false,
        fitSelectedRoutes: true,
        showAlternatives: false,
        createMarker: () => null
      }).addTo(map);

      routingControlRef.current.on('routesfound', (e) => {
        const routes = e.routes;
        if (routes && routes[0]) {
          const summary = routes[0].summary;
          const coords = routes[0].coordinates;
          const instructions = routes[0].instructions;
          
          if (onInstructionsFound) {
            onInstructionsFound({
              instructions,
              summary,
              coordinates: coords
            });
          }
        }
      });
    } else {
      // Update waypoints if control already exists (more stable than re-adding)
      routingControlRef.current.setWaypoints([
        L.latLng(start[0], start[1]),
        L.latLng(end[0], end[1])
      ]);
      
      // Update color if it changed
      routingControlRef.current.options.lineOptions.styles[0].color = color;
    }

    return () => {
      // We don't necessarily want to remove on every render, only on unmount
    };
  }, [map, start, end, color]); // Keeping deps, but logic inside handles it better

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (map && routingControlRef.current) {
        try {
          map.removeControl(routingControlRef.current);
        } catch (e) {
          console.error("Cleanup error in RoutingMachine:", e);
        }
        routingControlRef.current = null;
      }
    };
  }, [map]);

  return null;
};

export default RoutingMachine;

// ==========================================
// MAP SETUP
// ==========================================

const map = L.map("map").setView([20.5937, 78.9629], 5);

L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
        attribution: "&copy; OpenStreetMap contributors"
    }
).addTo(map);


// ==========================================
// VARIABLES
// ==========================================

let userLocation = null;
let places = [];

let userMarker = null;
let placeMarkers = [];
let routeLine = null;

// ==========================================
// GET USER LOCATION
// ==========================================

document
    .getElementById("locationBtn")
    .addEventListener("click", function () {

        if (!navigator.geolocation) {

            alert("Geolocation is not supported by your browser.");

            return;
        }

        navigator.geolocation.getCurrentPosition(

            function (position) {

                const latitude = position.coords.latitude;
                const longitude = position.coords.longitude;

                userLocation = [latitude, longitude];

                map.setView(userLocation, 13);


                // Remove old marker
                if (userMarker) {
                    map.removeLayer(userMarker);
                }


                // Create new marker
                userMarker = L.marker(userLocation)
                    .addTo(map)
                    .bindPopup("📍 Your Location")
                    .openPopup();

            },

            function () {

                alert("Unable to get your location.");

            }

        );

    });


// ==========================================
// ADD PLACE
// ==========================================

document
    .getElementById("addPlaceBtn")
    .addEventListener("click", function () {

        const input =
            document.getElementById("placeInput");

        const placeName =
            input.value.trim();


        if (placeName === "") {

            alert("Please enter a place.");

            return;
        }


        places.push(placeName);

        input.value = "";

        displayPlaces();

    });


// ==========================================
// DISPLAY PLACES
// ==========================================

function displayPlaces() {

    const placesList =
        document.getElementById("placesList");


    placesList.innerHTML = "";


    places.forEach(function (place, index) {

        const div =
            document.createElement("div");


        div.className = "place";


        div.innerHTML = `
            📍 ${index + 1}. ${place}
        `;


        placesList.appendChild(div);

    });

}


// ==========================================
// GEOCODING
// ==========================================

async function getCoordinates(placeName) {

    const url =
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(placeName)}&limit=1`;


    try {

        const response =
            await fetch(url);


        const data =
            await response.json();


        if (data.length === 0) {

            return null;

        }


        return {

            name: placeName,

            latitude:
                parseFloat(data[0].lat),

            longitude:
                parseFloat(data[0].lon)

        };

    }

    catch (error) {

        console.error(
            "Geocoding error:",
            error
        );

        return null;

    }

}


// ==========================================
// SHOW PLACE ON MAP
// ==========================================

function showPlaceOnMap(place) {

    const marker =
        L.marker([
            place.latitude,
            place.longitude
        ])
        .addTo(map)
        .bindPopup(
            `📍 ${place.name}`
        );


    placeMarkers.push(marker);

}

// ==========================================
// CALCULATE DISTANCE BETWEEN TWO LOCATIONS
// ==========================================

function calculateDistance(point1, point2) {

    const lat1 = point1.latitude;
    const lon1 = point1.longitude;

    const lat2 = point2.latitude;
    const lon2 = point2.longitude;


    const R = 6371; // Earth's radius in km


    const dLat =
        (lat2 - lat1) * Math.PI / 180;

    const dLon =
        (lon2 - lon1) * Math.PI / 180;


    const a =
        Math.sin(dLat / 2) *
        Math.sin(dLat / 2) +

        Math.cos(lat1 * Math.PI / 180) *
        Math.cos(lat2 * Math.PI / 180) *

        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);


    const c =
        2 * Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1 - a)
        );


    return R * c;
}
// ==========================================
// OPTIMIZE ROUTE
// ==========================================

function optimizeRoute(locations) {

    let remaining = [...locations];

    let route = [];

    let current = {

        latitude: userLocation[0],

        longitude: userLocation[1]

    };


    while (remaining.length > 0) {

        let closestIndex = 0;

        let shortestDistance =
            calculateDistance(
                current,
                remaining[0]
            );


        for (
            let i = 1;
            i < remaining.length;
            i++
        ) {

            const distance =
                calculateDistance(
                    current,
                    remaining[i]
                );


            if (
                distance <
                shortestDistance
            ) {

                shortestDistance = distance;

                closestIndex = i;

            }

        }


        const closestPlace =
            remaining[closestIndex];


        closestPlace.distanceFromPrevious =
            shortestDistance;


        route.push(closestPlace);


        current = {

            latitude:
                closestPlace.latitude,

            longitude:
                closestPlace.longitude

        };


        remaining.splice(
            closestIndex,
            1
        );

    }


    return route;
}
// ==========================================
// GET ACTUAL ROAD ROUTE
// ==========================================

async function getRoadRoute(route) {

    // OSRM expects:
    // longitude,latitude

    const coordinates = route.map(function(place) {

        return `${place.longitude},${place.latitude}`;

    }).join(";");


    const url =
        `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson`;


    try {

        const response = await fetch(url);

        const data = await response.json();


        if (data.code !== "Ok") {

            throw new Error("Route could not be found.");

        }


        return data.routes[0];

    }

    catch (error) {

        console.error(
            "Routing error:",
            error
        );

        return null;

    }

}
// ==========================================
// FORMAT TIME
// ==========================================

function formatTime(minutes) {

    const hours =
        Math.floor(minutes / 60);

    const remainingMinutes =
        Math.round(minutes % 60);


    if (hours === 0) {

        return `${remainingMinutes} min`;

    }


    return `${hours} hr ${remainingMinutes} min`;

}
// ==========================================
// PLAN TRIP
// ==========================================

document
    .getElementById("planBtn")
    .addEventListener("click", async function () {


        if (!userLocation) {

            alert(
                "Please select your location first."
            );

            return;

        }


        if (places.length === 0) {

            alert(
                "Please add at least one tourist spot."
            );

            return;

        }


        // Clear old markers
        placeMarkers.forEach(function (marker) {

            map.removeLayer(marker);

        });

        placeMarkers = [];


        const tripInfo =
            document.getElementById("tripInfo");


        tripInfo.innerHTML = `
            <h3>Finding your places...</h3>
            <p>Please wait.</p>
        `;


        // ==================================
        // GET COORDINATES
        // ==================================

        let locations = [];


        for (const place of places) {

            const coordinates =
                await getCoordinates(place);


            if (coordinates) {

                locations.push(coordinates);

                showPlaceOnMap(coordinates);

            }

        }


        // ==================================
        // CHECK RESULTS
        // ==================================

        if (locations.length === 0) {

            tripInfo.innerHTML = `
                <h3>❌ Places not found</h3>
                <p>
                    We couldn't find the locations.
                </p>
            `;

            return;

        }


        // ==================================
// OPTIMIZE ROUTE
// ==================================

const optimizedRoute =
    optimizeRoute(locations);

// ==========================================
// DRAW OPTIMIZED ROUTE
// ==========================================

// ==========================================
// GET ROAD ROUTE
// ==========================================

const routePlaces = [

    {
        latitude: userLocation[0],
        longitude: userLocation[1]
    },

    ...optimizedRoute

];


const roadRoute =
    await getRoadRoute(routePlaces);


if (!roadRoute) {

    tripInfo.innerHTML = `
        <h3>⚠️ Route Error</h3>
        <p>
            We couldn't calculate the driving route.
        </p>
    `;

    return;

}


// ==========================================
// DRAW ROAD ROUTE
// ==========================================

if (routeLine) {

    map.removeLayer(routeLine);

}


routeLine = L.geoJSON(
    roadRoute.geometry
).addTo(map);


// ==========================================
// GET DISTANCE & TIME
// ==========================================

const totalRoadDistance =
    roadRoute.distance / 1000;


const totalDrivingTime =
    roadRoute.duration / 60;


// ==========================================
// DISPLAY TRIP INFORMATION
// ==========================================

let routeHTML = `
    <h3>🗺️ Optimized Route</h3>

    <br>

    <p>
        🚗 <strong>Driving Distance:</strong>
        ${totalRoadDistance.toFixed(1)} km
    </p>

    <p>
        ⏱️ <strong>Driving Time:</strong>
        ${formatTime(totalDrivingTime)}
    </p>

    <hr>
`;


optimizedRoute.forEach(
    function(place, index) {

        routeHTML += `

            <div class="route-place">

                <strong>
                    ${index + 1}.
                    ${place.name}
                </strong>

            </div>

        `;

    }
);


tripInfo.innerHTML = routeHTML;


    });
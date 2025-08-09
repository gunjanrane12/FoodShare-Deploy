document.addEventListener('DOMContentLoaded', () => {
    fetch('/api/ngo/details')
    .then(response => response.json())
    .then(ngo => {
        const ngoNameElement = document.getElementById('ngoName');
        ngoNameElement.innerText = ngo.name; // Display NGO's name
    })
    .catch(error => {
        console.error('Error fetching NGO details:', error);
    });

    fetch('/api/food/available')
    .then(response => response.json())
    .then(posts => {
        const foodPostsOverview = document.getElementById('foodPostsOverview');
        
        // Clear previous content if any
        foodPostsOverview.innerHTML = '';

        posts.forEach(post => {
            const postElement = document.createElement('div');
            postElement.classList.add('post-card');

            // Create a toggle button for the modal
            postElement.innerHTML = `
                <h3>${post.food_title}</h3>
                <p>Quantity: ${post.meal_quantity}</p>
                <p>Expiry: ${new Date(post.expiry).toLocaleString()}</p>
                
                <button class="toggle-button">Show Posted By Details</button>
            `;

            // Add event listener for the toggle button
            const toggleButton = postElement.querySelector('.toggle-button');
            toggleButton.addEventListener('click', () => {
                const modal = document.getElementById('detailsModal');
                const modalContent = document.getElementById('modalDetailsContent');

                // Set the modal content
                modalContent.innerHTML = `
                    <h4>Posted By:</h4>
                    <p>Restaurant: ${post.restaurant_name}</p>
                    <p>Mobile: ${post.restaurant_mobile}</p>
                    <p>City: ${post.restaurant_city}</p>
                    <p>Address: ${post.restaurant_address}</p>
                `;

                modal.style.display = 'block'; // Show the modal
            });

            foodPostsOverview.appendChild(postElement);
        });
    })
    .catch(error => {
        console.error('Error fetching food posts:', error);
        foodPostsOverview.innerHTML = '<p>Error loading food posts.</p>';
    });

    // Close modal functionality
    const closeButton = document.querySelector('.close-button');
    closeButton.addEventListener('click', () => {
        const modal = document.getElementById('detailsModal');
        modal.style.display = 'none'; // Hide the modal
    });

    // Close modal when clicking outside of it
    window.addEventListener('click', (event) => {
        const modal = document.getElementById('detailsModal');
        if (event.target === modal) {
            modal.style.display = 'none'; // Hide the modal
        }
    });
});

document.getElementById('logoutButton').addEventListener('click', () => {
    fetch('/api/logout')
        .then(() => {
            window.location.href = '/'; // Redirect to home page after logout
        })
        .catch(error => {
            console.error('Error logging out:', error);
        });
});

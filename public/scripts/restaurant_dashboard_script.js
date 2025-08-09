// Fetch and display past food posts for the restaurant
document.addEventListener('DOMContentLoaded', () => {

    fetch('/api/restaurant/details')  // Adjust this endpoint based on your backend logic
    .then(response => response.json())
    .then(restaurant => {
        const restaurantNameElement = document.getElementById('restaurantName');
        restaurantNameElement.innerText = restaurant.name;  // Display restaurant's name
    })
    .catch(error => {
        console.error('Error fetching restaurant details:', error);
    });

    fetch('/api/restaurant/posts')  // Adjust this endpoint based on your backend logic
        .then(response => response.json())
        .then(pastPosts => {
            const pastPostsOverview = document.getElementById('pastPostsOverview');

            if (pastPosts.length === 0) {
                pastPostsOverview.innerHTML = '<p>No past posts available.</p>';
                return;
            }

            // Loop through the past posts and display them
            pastPosts.forEach(post => {
                const postElement = document.createElement('div');
                postElement.classList.add('post-item'); // Add a class for styling if needed
                postElement.classList.add('post-card');

                // Display the status of the post
                let statusMessage = post.status;
                postElement.innerHTML = `
                    <h3>${post.food_title}</h3>
                    <p>Quantity: ${post.meal_quantity}</p>
                    <p>Expiry: ${new Date(post.expiry).toLocaleString()}</p>
                    <p>Status: ${statusMessage}</p>
                    <button class="delete-btn" data-id="${post.id}">Delete</button>
                    ${post.status === 'active' ? `<button onclick="markAsAccepted(${post.id})">Mark as Accepted</button>` : ''}
                `;
                pastPostsOverview.appendChild(postElement);

                // Attach click event listener to the delete button
                postElement.querySelector('.delete-btn').addEventListener('click', function () {
                    const postId = this.getAttribute('data-id');
                    deletePost(postId, postElement);
                });
            });
        })
        .catch(error => {
            console.error('Error fetching past posts:', error);
            pastPostsOverview.innerHTML = '<p>Error loading past posts.</p>';
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
// Function to delete a post by ID
function deletePost(postId, postElement) {
    fetch(`/api/food/delete/${postId}`, {
        method: 'DELETE'
    })
    .then(response => {
        if (response.ok) {
            // Remove the post from the UI
            postElement.remove();
        } else {
            alert('Failed to delete post.');
        }
    })
    .catch(error => {
        console.error('Error deleting post:', error);
    });
}

function markAsAccepted(postId) {
    fetch(`/api/food/mark-accepted/${postId}`, {
        method: 'POST'
    })
    .then(response => {
        if (response.ok) {
            alert('Post marked as accepted');
            location.reload();  // Refresh the page to update the status
        } else {
            alert('Error marking post as accepted');
        }
    });
}

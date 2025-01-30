class RecipeFinder {
    constructor() {
        this.ingredients = new Set();
        this.baseUrl = 'https://www.themealdb.com/api/json/v1/1';
        this.setupEventListeners();
        this.initializeApp();
    }

    async initializeApp() {
        await this.loadCategories();
        await this.loadAreas();
        this.showSection('search');
    }

    setupEventListeners() {
        // Navigation
        document.querySelector('.nav-links').addEventListener('click', (e) => {
            if (e.target.classList.contains('nav-btn')) {
                this.showSection(e.target.dataset.section);
            }
        });

        // Search by name
        document.getElementById('recipe-search').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.searchByName();
            }
        });
        document.getElementById('search-by-name-btn').addEventListener('click', () => {
            this.searchByName();
        });

        // Ingredients
        document.getElementById('ingredient-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.addIngredient();
            }
        });
        document.getElementById('add-ingredient').addEventListener('click', () => {
            this.addIngredient();
        });
        document.getElementById('voice-input-btn').addEventListener('click', () => {
            this.startVoiceInput();
        });
        document.getElementById('search-recipes').addEventListener('click', () => {
            this.searchByIngredients();
        });

        // Filters
        document.getElementById('category-filter').addEventListener('change', (e) => {
            this.filterByCategory(e.target.value);
        });
        document.getElementById('area-filter').addEventListener('change', (e) => {
            this.filterByArea(e.target.value);
        });

        // Modal
        document.querySelector('.close').addEventListener('click', () => this.closeModal());
        window.addEventListener('click', (e) => {
            if (e.target === document.getElementById('recipe-modal')) {
                this.closeModal();
            }
        });
    }

    // Navigation and Section Management
    showSection(sectionName) {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.section === sectionName);
        });

        document.querySelectorAll('section').forEach(section => {
            section.classList.remove('active-section');
        });

        const section = document.getElementById(`${sectionName}-section`);
        if (section) {
            section.classList.add('active-section');
            if (sectionName === 'random') this.loadRandomRecipe();
        }
    }

    // API Calls
    async fetchData(endpoint) {
        this.showLoading();
        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`);
            if (!response.ok) throw new Error('Network response was not ok');
            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            this.showError('Failed to fetch data. Please try again.');
            return null;
        } finally {
            this.hideLoading();
        }
    }

    // Loading and Error Management
    showLoading() {
        document.getElementById('loading-spinner').style.display = 'flex';
    }

    hideLoading() {
        document.getElementById('loading-spinner').style.display = 'none';
    }

    showError(message) {
        alert(message);
    }

    // Ingredient Management
    addIngredient() {
        const input = document.getElementById('ingredient-input');
        const ingredient = input.value.trim().toLowerCase();
        
        if (ingredient && !this.ingredients.has(ingredient)) {
            this.ingredients.add(ingredient);
            this.renderIngredients();
            input.value = '';
        }
    }

    removeIngredient(ingredient) {
        this.ingredients.delete(ingredient);
        this.renderIngredients();
    }

    renderIngredients() {
        const container = document.getElementById('ingredients-list');
        container.innerHTML = '';

        this.ingredients.forEach(ingredient => {
            const tag = document.createElement('div');
            tag.className = 'ingredient-tag';
            tag.innerHTML = `
                ${ingredient}
                <button onclick="recipeFinder.removeIngredient('${ingredient}')">
                    <i class="fas fa-times"></i>
                </button>
            `;
            container.appendChild(tag);
        });
    }

    // Voice Input
    startVoiceInput() {
        if ('webkitSpeechRecognition' in window) {
            const recognition = new webkitSpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.lang = 'en-US';

            recognition.onstart = () => {
                document.getElementById('voice-input-btn').style.backgroundColor = '#ff4444';
            };

            recognition.onend = () => {
                document.getElementById('voice-input-btn').style.backgroundColor = '';
            };

            recognition.onresult = (event) => {
                const ingredient = event.results[0][0].transcript.toLowerCase();
                document.getElementById('ingredient-input').value = ingredient;
                this.addIngredient();
            };

            recognition.start();
        } else {
            this.showError('Voice input is not supported in your browser.');
        }
    }

    // Search and Filter Functions
    async searchByName() {
        const searchTerm = document.getElementById('recipe-search').value.trim();
        if (!searchTerm) return;

        const data = await this.fetchData(`/search.php?s=${encodeURIComponent(searchTerm)}`);
        if (data && data.meals) {
            this.displayResults(data.meals);
        } else {
            this.displayResults([]);
        }
    }

    async searchByIngredients() {
        if (this.ingredients.size === 0) {
            this.showError('Please add at least one ingredient.');
            return;
        }

        const mainIngredient = Array.from(this.ingredients)[0];
        const data = await this.fetchData(`/filter.php?i=${encodeURIComponent(mainIngredient)}`);
        
        if (data && data.meals) {
            const detailedRecipes = await Promise.all(
                data.meals.slice(0, 10).map(meal => 
                    this.fetchData(`/lookup.php?i=${meal.idMeal}`))
            );

            const filteredMeals = detailedRecipes
                .filter(data => data && data.meals && data.meals[0])
                .map(data => data.meals[0])
                .filter(recipe => this.matchesIngredients(recipe));

            this.displayResults(filteredMeals);
        } else {
            this.displayResults([]);
        }
    }

    async filterByCategory(category) {
        const data = await this.fetchData(`/filter.php?c=${encodeURIComponent(category)}`);
        if (data && data.meals) {
            this.displayResults(data.meals);
        }
    }

    async filterByArea(area) {
        const data = await this.fetchData(`/filter.php?a=${encodeURIComponent(area)}`);
        if (data && data.meals) {
            this.displayResults(data.meals);
        }
    }

    // Data Loading Functions
    async loadCategories() {
        const data = await this.fetchData('/categories.php');
        if (data && data.categories) {
            this.updateCategoryFilter(data.categories);
            this.updateCategoriesGrid(data.categories);
        }
    }

    async loadAreas() {
        const data = await this.fetchData('/list.php?a=list');
        if (data && data.meals) {
            this.updateAreaFilter(data.meals);
            this.updateAreasGrid(data.meals);
        }
    }

    async loadRandomRecipe() {
        const data = await this.fetchData('/random.php');
        if (data && data.meals) {
            document.getElementById('random-section').innerHTML = 
                this.createDetailedRecipeCard(data.meals[0]);
        }
    }

    // Display Functions
    displayResults(meals) {
        const container = document.getElementById('results-section');
        container.innerHTML = '';

        if (!meals || meals.length === 0) {
            container.innerHTML = `
                <div class="no-results">
                    <i class="fas fa-search" style="font-size: 48px; color: #ccc;"></i>
                    <p>No recipes found. Try different search terms or filters.</p>
                </div>`;
            return;
        }

        meals.forEach(meal => {
            container.appendChild(this.createRecipeCard(meal));
        });
    }

    createRecipeCard(meal) {
        const card = document.createElement('div');
        card.className = 'recipe-card';
        card.onclick = () => this.showRecipeDetails(meal.idMeal);

        card.innerHTML = `
            <img src="${meal.strMealThumb}" alt="${meal.strMeal}">
            <div class="recipe-card-content">
                <h3>${meal.strMeal}</h3>
                <div class="recipe-meta">
                    <span><i class="fas fa-globe"></i> ${meal.strArea || 'Various'}</span>
                    <span><i class="fas fa-tag"></i> ${meal.strCategory || 'General'}</span>
                </div>
            </div>
        `;

        return card;
    }

    async showRecipeDetails(id) {
        const data = await this.fetchData(`/lookup.php?i=${id}`);
        if (data && data.meals) {
            const recipe = data.meals[0];
            const modal = document.getElementById('recipe-modal');
            const content = document.getElementById('modal-recipe-content');

            content.innerHTML = this.createDetailedRecipeCard(recipe);
            modal.style.display = 'block';
        }
    }

    closeModal() {
        document.getElementById('recipe-modal').style.display = 'none';
    }

    // Helper Functions
    matchesIngredients(recipe) {
        const recipeIngredients = new Set();
        for (let i = 1; i <= 20; i++) {
            const ingredient = recipe[`strIngredient${i}`];
            if (ingredient && ingredient.trim()) {
                recipeIngredients.add(ingredient.toLowerCase());
            }
        }

        return Array.from(this.ingredients).every(ingredient =>
            Array.from(recipeIngredients).some(recipeIng =>
                recipeIng.includes(ingredient.toLowerCase())
            )
        );
    }

    createDetailedRecipeCard(recipe) {
        const ingredients = [];
        for (let i = 1; i <= 20; i++) {
            const ingredient = recipe[`strIngredient${i}`];
            const measure = recipe[`strMeasure${i}`];
            if (ingredient && ingredient.trim()) {
                ingredients.push(`<li>${measure} ${ingredient}</li>`);
            }
        }

        return `
            <h2>${recipe.strMeal}</h2>
            <img src="${recipe.strMealThumb}" alt="${recipe.strMeal}" style="max-width: 100%; border-radius: 10px;">
            
            <div class="recipe-info">
                <p><i class="fas fa-globe"></i> Cuisine: ${recipe.strArea}</p>
                <p><i class="fas fa-tag"></i> Category: ${recipe.strCategory}</p>
                ${recipe.strTags ? `<p><i class="fas fa-tags"></i> Tags: ${recipe.strTags}</p>` : ''}
                ${recipe.strYoutube ? `<p><i class="fab fa-youtube"></i> <a href="${recipe.strYoutube}" target="_blank">Watch Video</a></p>` : ''}
            </div>

            <h3>Ingredients:</h3>
            <ul class="ingredients-list">
                ${ingredients.join('')}
            </ul>

            <h3>Instructions:</h3>
            <div class="instructions">
                ${recipe.strInstructions.split('\n').map(step => `<p>${step}</p>`).join('')}
            </div>
        `;
    }
}

// Initialize the application
const recipeFinder = new RecipeFinder();
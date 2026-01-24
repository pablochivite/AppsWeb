/**
 * Analysis Chat UI Component
 * Handles user queries and renders visualizations using Chart.js
 */

import { analyzeQuery } from "../services/analysisAgentService.js";

let chartInstance = null;

/**
 * Initialize the analysis chat component
 */
export function initAnalysisChat() {
  const queryInput = document.getElementById("analysis-query-input");
  const submitButton = document.getElementById("analysis-query-submit");
  const loadingIndicator = document.getElementById("analysis-loading");
  const errorContainer = document.getElementById("analysis-error");
  const clarificationContainer = document.getElementById("analysis-clarification");
  const chartContainer = document.getElementById("analysis-chart-container");
  const insightsContainer = document.getElementById("analysis-insights");
  const recommendationsContainer = document.getElementById("analysis-recommendations");

  if (!queryInput || !submitButton) {
    console.warn("Analysis chat elements not found");
    return;
  }

  // Handle form submission
  submitButton.addEventListener("click", handleSubmit);
  queryInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      handleSubmit();
    }
  });

  async function handleSubmit() {
    const query = queryInput.value.trim();
    
    if (!query) {
      showError("Por favor ingresa una consulta");
      return;
    }

    // Hide previous results
    hideAllContainers();
    
    // Show loading
    loadingIndicator?.classList.remove("hidden");
    submitButton.disabled = true;

    try {
      const result = await analyzeQuery(query);

      // Hide loading
      loadingIndicator?.classList.add("hidden");
      submitButton.disabled = false;

      // Handle clarification
      if (result.needsClarification && result.clarificationQuestion) {
        showClarification(result.clarificationQuestion);
        return;
      }

      // Render visualization if available
      if (result.visualizationSpec) {
        renderChart(result.visualizationSpec);
      }

      // Render insights
      if (result.insights && result.insights.length > 0) {
        renderInsights(result.insights);
      }

      // Render recommendations
      if (result.recommendations && result.recommendations.length > 0) {
        renderRecommendations(result.recommendations);
      }

      // Clear input
      queryInput.value = "";
    } catch (error) {
      console.error("Error analyzing query:", error);
      loadingIndicator?.classList.add("hidden");
      submitButton.disabled = false;
      showError(error.message || "Error al analizar la consulta. Por favor intenta de nuevo.");
    }
  }

  function hideAllContainers() {
    errorContainer?.classList.add("hidden");
    clarificationContainer?.classList.add("hidden");
    chartContainer?.classList.add("hidden");
    insightsContainer?.classList.add("hidden");
    recommendationsContainer?.classList.add("hidden");
  }

  function showError(message) {
    if (errorContainer) {
      const errorText = document.getElementById("error-text");
      if (errorText) {
        errorText.textContent = message;
      }
      errorContainer.classList.remove("hidden");
    }
  }

  function showClarification(question) {
    if (clarificationContainer) {
      const clarificationText = document.getElementById("clarification-text");
      if (clarificationText) {
        clarificationText.textContent = question;
      }
      clarificationContainer.classList.remove("hidden");
    }
  }

  function renderChart(spec) {
    if (!chartContainer) return;

    // Dynamically import Chart.js
    import("https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js")
      .then((ChartModule) => {
        const Chart = ChartModule.default || ChartModule.Chart;
        const canvas = document.getElementById("analysis-chart");
        
        if (!canvas) return;

        // Destroy previous chart if exists
        if (chartInstance) {
          chartInstance.destroy();
        }

        // Create new chart
        chartInstance = new Chart(canvas, {
          type: spec.type,
          data: spec.data,
          options: {
            ...spec.options,
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
              ...spec.options?.plugins,
              legend: {
                ...spec.options?.plugins?.legend,
                labels: {
                  color: "rgba(255, 255, 255, 0.8)",
                },
              },
              title: {
                ...spec.options?.plugins?.title,
                color: "rgba(255, 255, 255, 0.9)",
              },
            },
            scales: spec.options?.scales ? {
              ...spec.options.scales,
              x: {
                ...spec.options.scales.x,
                ticks: {
                  ...spec.options.scales.x?.ticks,
                  color: "rgba(255, 255, 255, 0.7)",
                },
                grid: {
                  ...spec.options.scales.x?.grid,
                  color: "rgba(255, 255, 255, 0.1)",
                },
              },
              y: {
                ...spec.options.scales.y,
                ticks: {
                  ...spec.options.scales.y?.ticks,
                  color: "rgba(255, 255, 255, 0.7)",
                },
                grid: {
                  ...spec.options.scales.y?.grid,
                  color: "rgba(255, 255, 255, 0.1)",
                },
              },
            } : undefined,
          },
        });

        chartContainer.classList.remove("hidden");
      })
      .catch((error) => {
        console.error("Error loading Chart.js:", error);
        showError("Error al cargar la librería de gráficos");
      });
  }

  function renderInsights(insights) {
    if (!insightsContainer) return;

    const insightsList = document.getElementById("insights-list");
    if (!insightsList) return;

    insightsList.innerHTML = "";
    insights.forEach((insight) => {
      const li = document.createElement("li");
      li.className = "flex items-start gap-2";
      li.innerHTML = `
        <span class="text-white/60 mt-1">•</span>
        <span>${insight}</span>
      `;
      insightsList.appendChild(li);
    });

    insightsContainer.classList.remove("hidden");
  }

  function renderRecommendations(recommendations) {
    if (!recommendationsContainer) return;

    const recommendationsList = document.getElementById("recommendations-list");
    if (!recommendationsList) return;

    recommendationsList.innerHTML = "";
    recommendations.forEach((recommendation) => {
      const li = document.createElement("li");
      li.className = "flex items-start gap-2";
      li.innerHTML = `
        <span class="text-green-400 mt-1">✓</span>
        <span>${recommendation}</span>
      `;
      recommendationsList.appendChild(li);
    });

    recommendationsContainer.classList.remove("hidden");
  }
}


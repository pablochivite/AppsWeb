# LangGraph Analysis Agent Architecture

## Overview

The LangGraph Analysis Agent is a Cloud Functions-based service that uses LangGraph.js to orchestrate complex analysis workflows. It provides intelligent analysis of training data and generates visualizations using Generative UI patterns.

## Architecture Diagram

```
Frontend (Vite)
    ↓
analysisAgentService.js
    ↓
Cloud Functions HTTP Endpoint
    ↓
LangGraph Workflow
    ├── Router Node (semantic intent classification)
    ├── Fetch Data Node (Firestore queries)
    ├── Analysis Node (LLM-powered analysis)
    └── Visualization Node (Chart.js spec generation)
    ↓
OpenAI API
```

## Components

### Backend (Cloud Functions)

#### 1. HTTP Endpoint (`functions/src/api/analyze.ts`)
- Validates Firebase Auth tokens
- Extracts user ID from token
- Executes LangGraph workflow
- Returns JSON response with visualization specs and insights

#### 2. Workflow (`functions/src/graph/workflow.ts`)
- Orchestrates the agent execution
- Manages state transitions between nodes
- Validates state with Zod schemas

#### 3. Nodes

**Router Node** (`functions/src/graph/nodes/router-node.ts`)
- Uses LLM to semantically classify user intent
- Routes to: `analysis`, `training`, or `clarification`
- NO regex - pure semantic understanding

**Fetch Data Node** (`functions/src/graph/nodes/fetch-data-node.ts`)
- Queries Firestore for:
  - Completed sessions (last 3 months)
  - Milestones
  - Baseline assessment

**Analysis Node** (`functions/src/graph/nodes/analysis-node.ts`)
- Analyzes data using LLM with REGAIN context
- Generates insights, metrics, and recommendations
- Validates output with Zod

**Visualization Node** (`functions/src/graph/nodes/visualization-node.ts`)
- Generates Chart.js specification using LLM
- Creates JSON config for frontend rendering
- Supports: line, bar, pie, radar charts

#### 4. Services

**Firestore Service** (`functions/src/services/firestore-service.ts`)
- Uses `firebase-admin` for server-side Firestore access
- Functions:
  - `getCompletedSessions(userId, startDate?, endDate?)`
  - `getMilestones(userId)`
  - `getBaselineAssessment(userId)`
  - `getTrainingSystems(userId)`

**OpenAI Service** (`functions/src/services/openai-service.ts`)
- Configures OpenAI client with API key from Firebase config
- Helper functions:
  - `classifyIntent(query)` - Semantic intent classification
  - `analyzeData(data, query)` - Data analysis with LLM
  - `generateChartSpec(metrics, query)` - Chart specification generation

### Frontend

#### 1. Service (`js/services/analysisAgentService.js`)
- Makes HTTP requests to Cloud Functions
- Handles authentication token management
- Supports both emulator and production URLs

#### 2. UI Component (`js/ui/analysis-chat.js`)
- Manages user input and query submission
- Renders Chart.js visualizations
- Displays insights and recommendations
- Handles clarification requests (human-in-the-loop)

#### 3. HTML Template (`html/components/analysis-chat.html`)
- Input field for queries
- Loading indicators
- Chart canvas
- Insights and recommendations lists

## State Management

The agent uses a Zod-validated state schema:

```typescript
{
  userId: string;
  userQuery: string;
  messages: Array<{role, content}>;
  route?: 'analysis' | 'training' | 'clarification';
  analyticsData?: {
    completedSessions: any[];
    milestones: any[];
    baselineAssessment: any;
  };
  analysis?: {
    insights: string[];
    metrics: Record<string, number>;
    recommendations: string[];
  };
  visualizationSpec?: {
    type: 'line' | 'bar' | 'pie' | 'radar';
    data: any;
    options: any;
  };
  currentStep: 'router' | 'fetch_data' | 'analyze' | 'visualize' | 'complete';
  needsClarification: boolean;
  clarificationQuestion?: string;
}
```

## Workflow Execution

1. **Router**: Classifies user intent semantically
2. **Fetch Data**: Retrieves relevant data from Firestore
3. **Analyze**: LLM analyzes data and generates insights
4. **Visualize**: LLM generates Chart.js specification
5. **Complete**: Returns results to frontend

## Security

1. **API Keys**: Never exposed in frontend - stored in Cloud Functions config
2. **Authentication**: All requests require valid Firebase Auth token
3. **Validation**: All LLM responses validated with Zod schemas
4. **CORS**: Configured for specific origins in production

## Configuration

### Cloud Functions

Set OpenAI API key:
```bash
firebase functions:config:set openai.key="your-api-key-here"
```

### Environment Variables

For local development with emulator:
```bash
OPENAI_API_KEY=your-api-key-here
```

### Frontend

No API keys needed - uses Cloud Functions endpoint.

## Usage Examples

### Example Query: "¿Cómo va mi progresión en pecho este mes?"

1. Router classifies as `analysis`
2. Fetches completed sessions from last month
3. Analyzes sessions targeting chest muscles
4. Generates line chart showing progression
5. Returns insights and recommendations

### Example Query: "Muéstrame mi evolución de movilidad"

1. Router classifies as `analysis`
2. Fetches all completed sessions
3. Analyzes mobility metrics over time
4. Generates line chart with mobility scores
5. Returns insights about mobility trends

## Error Handling

- **Network errors**: Displayed to user with retry option
- **LLM errors**: Fallback to default responses
- **Validation errors**: Logged and handled gracefully
- **Clarification needed**: Human-in-the-loop pattern

## Future Enhancements

- [ ] Support for multi-turn conversations
- [ ] Caching of analysis results
- [ ] More chart types (scatter, bubble, etc.)
- [ ] Export charts as images
- [ ] Comparison between time periods
- [ ] Integration with voice input

## Troubleshooting

### "OpenAI API key not configured"
- Set API key in Firebase Functions config
- Or set `OPENAI_API_KEY` environment variable for emulator

### "Unauthorized: Invalid token"
- Ensure user is logged in
- Check Firebase Auth token is valid

### Charts not rendering
- Check Chart.js is loaded (CDN or npm)
- Verify `visualizationSpec` structure is valid

### No data returned
- Check user has completed sessions
- Verify Firestore security rules allow read access


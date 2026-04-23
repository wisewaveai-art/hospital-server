exports.predictDisease = async (req, res) => {
  try {
    const { symptoms } = req.body;
    if (!symptoms || symptoms.trim() === '') {
      return res.status(400).json({ error: 'Symptoms are required for prediction' });
    }

    const API_URL = "https://api-inference.huggingface.co/models/facebook/bart-large-mnli";
    
    const candidate_labels = [
      'Viral Infection or Flu',
      'Common Cold',
      'Migraine',
      'Myocardial Infarction / Heart Risk',
      'Food Poisoning',
      'Malaria or Dengue',
      'Diabetes',
      'Asthma',
      'Hypertension',
      'Arthritis',
      'Pneumonia',
      'Tuberculosis'
    ];

    const headers = { "Content-Type": "application/json" };
    // Optionally use HF API key if available in .env to prevent rate limiting
    if (process.env.HUGGINGFACE_API_KEY) {
        headers["Authorization"] = `Bearer ${process.env.HUGGINGFACE_API_KEY}`;
    }

    const response = await fetch(API_URL, {
        method: "POST",
        headers: headers,
        body: JSON.stringify({
            inputs: symptoms,
            parameters: { candidate_labels }
        }),
    });

    if (!response.ok) {
        const errText = await response.text();
        console.error('HuggingFace Error:', errText);
        // Sometimes HF models take time to load on first request
        if (response.status === 503 || String(errText).includes('Loading model')) {
            return res.status(503).json({ error: 'AI model is currently loading, please try again in 15 seconds.' });
        }
        return res.status(response.status).json({ error: 'HuggingFace inference failed. (If rate limited, add HUGGINGFACE_API_KEY to .env)' });
    }

    const result = await response.json();

    let topPredictions = [];
    if (result.labels && result.scores) {
        topPredictions = result.labels.slice(0, 3).map((label, index) => ({
            disease: label,
            confidence: (result.scores[index] * 100).toFixed(2)
        }));
    }

    res.status(200).json({
      message: 'AI Prediction successful',
      predictions: topPredictions
    });
  } catch (error) {
    console.error('Error in predictDisease:', error);
    res.status(500).json({ error: 'Failed to predict disease' });
  }
};

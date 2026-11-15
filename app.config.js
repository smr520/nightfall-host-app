// Browser rendering is an opt-in development aid; Android remains the shipping platform.
module.exports = ({ config }) => process.env.NIGHTFALL_UI_PREVIEW === '1'
  ? { ...config, platforms: ['android', 'web'], web: { ...config.web, bundler: 'metro' } }
  : config;

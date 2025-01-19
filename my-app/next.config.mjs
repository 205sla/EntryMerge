/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true
  },
  distDir: 'build',
  trailingSlash: true,
  // webpack 설정 제거
  // webpack: (config) => {
  //   config.module.rules.push({
  //     test: /\.css$/,
  //     use: ['style-loader', 'css-loader', 'postcss-loader']
  //   });
  //   return config;
  // }
};

export default nextConfig;

# Use the official Node.js image
FROM node:20

# Set the working directory inside the container
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --production

# Copy the rest of your application code
COPY . .

# Expose the port your Express app uses
EXPOSE 4000

# Command to start your specific server file
CMD ["node", "server/index.js"]
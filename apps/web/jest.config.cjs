module.exports={
  preset:'ts-jest',
  testEnvironment:'jsdom',
  roots:['<rootDir>/src'],
  testMatch:['**/*.spec.ts','**/*.spec.tsx'],
  moduleNameMapper:{'^@/(.*)$':'<rootDir>/src/$1','^lucide-react$':'<rootDir>/src/test/lucide-mock.cjs'},
  transform:{'^.+\\.(t|j)sx?$':['ts-jest',{tsconfig:{jsx:'react-jsx'}}]},
};

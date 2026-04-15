#!/usr/bin/env python3
with open('/tmp/src/app/screens/PaletteScreen.tsx', 'r') as f:
    content = f.read()

# Fix the two problematic lines
content = content.replace(
    'className={`flex ${\\n                            msg.role === "user" ? "justify-end" : "justify-start"\n                          }`}',
    'className={`flex ${\n                            msg.role === "user" ? "justify-end" : "justify-start"\n                          }`}'
)

content = content.replace(
    'className={`max-w-[85%] rounded-xl px-3 py-2 ${\\n                                msg.role === "user"\n                                  ? "bg-blue-500 text-white"\n                                  : "bg-gray-100 text-gray-900"\n                              }`}',
    'className={`max-w-[85%] rounded-xl px-3 py-2 ${\n                                msg.role === "user"\n                                  ? "bg-blue-500 text-white"\n                                  : "bg-gray-100 text-gray-900"\n                              }`}'
)

with open('/tmp/src/app/screens/PaletteScreen.tsx', 'w') as f:
    f.write(content)

print("Fixed!")

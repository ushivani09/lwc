## **Second Version of Error Code Proposal.** 
Proposal summary is identical from the original [proposal](https://git.soma.salesforce.com/raptor/raptor/blob/apapko/issue-603/error-codes-system-proposal/docs/proposals/error-code-system.md). However, error processing deviates in the way errors are parsed and stored. From @p-dartus summary

### AssemblyScript summary
>[AssemblyScript](https://github.com/AssemblyScript/assemblyscript) compiler provides an interesting approach for specifying error. This error system is inspired from typescript compiler. All the errors are stored into [a json file](https://github.com/AssemblyScript/assemblyscript/blob/28e08df053a4402a43ecaa1333c190351ae777ba/src/typescript/diagnosticMessages.json). At build time it generates an actual typescript file exporting those errors that you can reference from your code: https://github.com/AssemblyScript/assemblyscript/blob/28e08df053a4402a43ecaa1333c190351ae777ba/src/compiler.ts#L427
>However this approach make it a [little verbose](https://github.com/AssemblyScript/assemblyscript/blob/28e08df053a4402a43ecaa1333c190351ae777ba/src/compiler.ts#L925) for complex error messages.

The AssemblyScript implementation stores its errors in json file in following format:
```
"Unsupported node kind {0} in {1}.": {
    "code": 100,
    "category": "Error"
  }
```

This JSON [file is then parsed to create a typescript file](https://github.com/AssemblyScript/assemblyscript/blob/master/scripts/build-diagnostics.js), which is then referenced in their invariant-equivalent function call ex:
```this.report(declaration.name, typescript.DiagnosticsEx.Type_expected); ```

### Raptor version
Now that AssemblyScript summary has been stated, here is our Proposal:

**1.** As with [proposal #1](https://git.soma.salesforce.com/raptor/raptor/blob/apapko/issue-603/error-codes-system-proposal/docs/proposals/error-code-system.md) , an assert statement will be replaced with invariant( condition, errorMessage, arguments )

**2.** errorMessage - will refer to a compiled script file typescript.Diagnostics or whatever name we choose, which will contain objects with error specific information, such as error text, code, arguments array ex:
```
{
    "message" : "Invalid {$type} specified by {$functionName}!"
    "code": 100,
    "category": "Error"
    "arguments": ["number", "foo()"]
}
```
This will allow for following retrieval: typescript.Diagnostics.someKey.message/code depending on the dev/prod environment.

However, unlike the AssemblyScript implementation, we are not going to use the actual message string as a key in errors.json. Here is their implementation ex:
```
 "Conversion from '{0}' to '{1}' will fail when switching between WASM32/64.'": {
    "code": 109,
    "category": "Warning"
  }
```
As you see, the key is verbose, requires processing to normalize key's value prior typescript conversion, and can get very long in the compiled version when referenced in the code ex:
```
this.report(node, 
typescript.DiagnosticsEx.Conversion_from_0_to_1_will_fail_when_switching_between_WASM32_64, fromType.toString(), toType.toString()); 
```

Instead we will come up with a key pattern,  perhaps domain + message ( ex: engine_invalid_vm ). The key uniqueness will be checked when we generate typescript file, which will ensure no duplicates.

**3.** error.json to typescrip conversion script - will be ran by developers whenever new entry to the errors.json is added. Regenerated typescript file will then contain new error and can be referenced in the invariant(condition, typescript.Diagnostics.newKey)

**4.** replace-invariant-error-codes.js - is a Babel pass that rewrites error messages to IDs for a production (minified) build. ex:
```
// Turns this code:
invariant(condition, message, arguments);
```
            
```
// into this:
if (!condition) {
     if ("production" !== process.env.NODE_ENV) {
         invariant(false, typescript.Diagnostics.key.message, 'bar');
     } else {
         PROD_INVARIANT(typescript.Diagnostics.key.code, 'foo', 'bar');
     }
}
```

**5.** raptorProdInvariant.js is the replacement for invariant code in production, that accepts errorCode, arguments, and builds raptor error url. ex: https://raptor.sfdc.es/docs/error-decoder.html?id=1001&arg1='foo'&arg2='bar'.

**6.** ErrorDecoderComponent is a Raptor component that lives at https://raptor.sfdc.es/docs/error-decoder.html. This page takes parameters like raptor version and errorCode. Our documentation site will need to have support for adding the latest codes.json to the error decoder page. 




Cons:
- Manually maintained message file
- File must be compiled prior using it during development
- One large errors.json file may make it hard to locate existing errors ( not unless we introduce domain specific type typescript.Diagnostics.Engine.someKey )

Pros:
- Typed error objects
- Only one file to maintain 
- Automatic duplicate checks during errors.json to typescript file conversion
- Strict structure
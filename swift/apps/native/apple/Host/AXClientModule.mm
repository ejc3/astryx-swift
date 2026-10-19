// The `AXClient` native module: js/specs/NativeAXClient.ts, implemented. It decides
// nothing: each call from the core goes to the app's services, and each call from the
// app goes out as an event.

#import "AXClientLink.h"

#import <AXClientSpec/AXClientSpec.h>

@interface AXClientModule : NativeAXClientSpecBase <NativeAXClientSpec, AXClientEmitter>
@end

static id<AXClientServices> sServices;
static __weak AXClientModule *sModule;

@implementation AXClientLink

+ (id<AXClientServices>)services
{
  return sServices;
}

+ (void)setServices:(id<AXClientServices>)services
{
  sServices = services;
}

+ (id<AXClientEmitter>)emitter
{
  return sModule;
}

@end

@implementation AXClientModule

RCT_EXPORT_MODULE(AXClient)

/// React Native makes the module and only then installs the callback its events go out
/// through; until then an event would call an empty function, which ends the process.
/// So the module is not the app's emitter until here.
- (void)setEventEmitterCallback:(EventEmitterCallbackWrapper *)eventEmitterCallbackWrapper
{
  [super setEventEmitterCallback:eventEmitterCallbackWrapper];
  sModule = self;
}

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeAXClientSpecJSI>(params);
}

- (void)connected:(double)bridgeVersion
{
  [sServices libraryConnectedWithBridgeVersion:(NSInteger)bridgeVersion];
}

- (void)changed:(NSString *)storeName snapshotJSON:(NSString *)snapshotJSON
{
  [sServices storeChanged:storeName snapshotJSON:snapshotJSON];
}

- (void)answered:(double)callId result:(NSString *_Nullable)result error:(NSString *_Nullable)error
{
  [sServices callAnswered:(NSInteger)callId result:result error:error];
}

- (NSString *_Nullable)start
{
  return [sServices startJSON];
}

- (void)call:(NSInteger)callId operation:(NSString *)operation argument:(NSString *)argument
{
  [self emitOnCall:@{@"callId" : @(callId), @"operation" : operation, @"argument" : argument}];
}

@end
